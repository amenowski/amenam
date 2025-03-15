const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const Packet = require('../packet');
const SessionManager = require('../modules/SessionManager');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

function broadcastFriendUpdate(gameServer, userId, targetUserId = null) {
    if (!gameServer || !gameServer.bubbleServer || !gameServer.bubbleServer.clients) {
        return;
    }

    const uniqueUserIds = new Set([userId]);
    if (targetUserId) uniqueUserIds.add(targetUserId);

    // Używamy bubbleServer.clients zamiast gameServer.clients
    gameServer.bubbleServer.clients.forEach(async (client) => {
        if (client?.playerTracker?.userInfo?.id && uniqueUserIds.has(client.playerTracker.userInfo.id)) {
            try {
                const { data: friends } = await supabase
                    .from('friends')
                    .select(`
                        *,
                        users!friends_user_id_fkey(nick),
                        friend:users!friends_friend_id_fkey(nick)
                    `)
                    .or(`user_id.eq.${client.playerTracker.userInfo.id},friend_id.eq.${client.playerTracker.userInfo.id}`)
                    .not('status', 'eq', 'rejected');

                if (friends) {
                    const mappedFriends = friends.map(friend => {
                        const friendNick = friend.user_id === client.playerTracker.userInfo.id ? 
                            friend.friend.nick : friend.users.nick;

                        // Sprawdzamy status w bubbleServer
                        const clientInfo = gameServer.bubbleServer.clients.find(c => 
                            c.playerTracker?.name === friendNick
                        );

                        return {
                            i: friend.id,
                            n: friendNick,
                            o: !!clientInfo,
                            s: clientInfo?.playerTracker?.cells?.length > 0 ? 1 : 0,
                            c: JSON.stringify({
                                r: Math.floor(Math.random() * 255),
                                g: Math.floor(Math.random() * 255),
                                b: Math.floor(Math.random() * 255)
                            }),
                            p: 0
                        };
                    });

                    client.send(JSON.stringify({
                        friends: mappedFriends
                    }));
                }
            } catch (err) {
                console.error('Błąd wysyłania aktualizacji znajomych:', err);
            }
        }
    });
}

router.get('/online-empty', (req, res) => {
    res.render('online-empty');
});

router.get('/online-list', (req, res) => {
    try {
        const onlineFriends = JSON.parse(req.query.onlineFriends || '[]');
        res.render('online-list', { onlineFriends });
    } catch (error) {
        console.error('Błąd renderowania listy znajomych online:', error);
        res.status(500).send('Błąd serwera');
    }
});

router.get('/ad-f', (req, res) => {
    res.render('ad-f');
});

router.get('/friends-template', (req, res) => {
    try {
        const friends = JSON.parse(req.query.friends || '[]');
        res.render('f1s', { friends });
    } catch (error) {
        console.error('Błąd renderowania szablonu znajomych:', error);
        res.status(500).send('Błąd serwera');
    }
});

/**
 * GET /f - Endpoint do pobierania danych o znajomych
 * Query params:
 * - a: akcja ('l' - lista, 's' - statusy)
 */
router.use(async (req, res, next) => {
    try {
        const userHash = req.cookies.userHash;
        if (userHash) {
            const user = await SessionManager.checkAuth(userHash);
            if (user) req.user = user;
        }
        next();
    } catch (error) {
        console.error('Błąd autoryzacji:', error);
        next();
    }
});
router.get('/f', async (req, res) => {
    try {


        const { a } = req.query;
        const INACTIVE_TIMEOUT = 5 * 60;

        // Oznacz nieaktywnych użytkowników jako offline
        await supabase
            .from('users')
            .update({ is_online: false })
            .lt('last_seen', new Date(Date.now() - INACTIVE_TIMEOUT * 1000).toISOString());

        switch (a) {
            case 'l': // list - pobierz listę znajomych
            const { data: friends, error } = await supabase
                .from('friends')
                .select(`
                    *,
                    users!friends_user_id_fkey(nick),
                    friend:users!friends_friend_id_fkey(nick)
                `)
                .or(`user_id.eq.${req.user.id},friend_id.eq.${req.user.id}`)
                .not('status', 'eq', 'rejected');

            if (error) throw error;
            
            if (!friends || friends.length === 0) {
                return res.json([]);
            }

            // Mapuj dane do formatu odpowiedzi
                const mappedFriends = friends.map(friend => {
                const friendNick = friend.user_id === req.user.id ? friend.friend.nick : friend.users.nick;

                const OFFLINE_TIMEOUT = 300; 

                
                const clientInfo = req.gameServer?.clients.find(client => 
                    client.playerTracker?.name === friendNick && 
                    Date.now() - client.playerTracker?.lastActivity < OFFLINE_TIMEOUT
                );
                
                const isInGame = clientInfo?.playerTracker?.cells?.length > 0;
                const isOnline = !!clientInfo;
            
                return {
                    id: friend.id,
                    nick: friendNick,
                    status: friend.status,
                    isReceiver: friend.friend_id === req.user.id,
                    isOnline: isOnline,
                    inGame: isInGame,
                    message: friend.message
                };
            });

                broadcastFriendUpdate(req.gameServer);

                return res.json(mappedFriends);

            case 's': // status - pobierz statusy znajomych
                const { data: statusFriends, error: statusError } = await supabase
                    .from('friends')
                    .select(`
                        id,
                        friend:users!friends_friend_id_fkey(is_online, last_seen)
                    `)
                    .eq('user_id', req.user.id)
                    .eq('status', 'accepted');

                if (statusError) throw statusError;

                // Przygotuj mapę statusów
                const statuses = statusFriends.reduce((acc, friend) => {
                    acc[friend.id] = friend.friend?.is_online || false;
                    return acc;
                }, {});

                return res.json(statuses);

            default:
                return res.status(400).json({ e: 'Nieprawidłowa akcja' });
        }
    } catch (error) {
        console.error('Błąd API przyjaciół:', error);
        res.status(500).json({ e: 'Błąd serwera' });
    }
});

/**
 * POST /f - Endpoint do modyfikacji danych znajomych
 * Body params:
 * - a: akcja ('i' - zaproś, 'r' - odpowiedz, 'd' - usuń, 'u' - aktualizuj status)
 * - d: dane specyficzne dla akcji
 */
router.post('/f', async (req, res) => {
    try {


        const { a, d } = req.body;

        switch (a) {
            case 'i': // invite - zaproś znajomego
                const { n: playerName, m: message } = d;
                
                // Sprawdź czy nie próbuje zaprosić sam siebie
                if (playerName === req.user.nick) {
                    return res.status(400).json({ e: 'Nie możesz zaprosić samego siebie' });
                }

                // Znajdź zapraszanego gracza
                const { data: invitedPlayer } = await supabase
                    .from('users')
                    .select('id')
                    .eq('nick', playerName)
                    .single();

                if (!invitedPlayer) {
                    return res.status(404).json({ e: 'Nie znaleziono gracza' });
                }

                // Sprawdź czy już istnieje relacja
                const { data: existingInvite } = await supabase
                    .from('friends')
                    .select('id, status')
                    .or(`and(user_id.eq.${req.user.id},friend_id.eq.${invitedPlayer.id}),and(user_id.eq.${invitedPlayer.id},friend_id.eq.${req.user.id})`)
                    .single();

                if (existingInvite) {
                    if (existingInvite.status === 'pending') {
                        return res.status(400).json({ e: 'Zaproszenie już wysłane' });
                    }
                    if (existingInvite.status === 'accepted') {
                        return res.status(400).json({ e: 'Już jesteście znajomymi' });
                    }
                }

                // Dodaj zaproszenie
                await supabase
                    .from('friends')
                    .insert([{
                        user_id: req.user.id,
                        friend_id: invitedPlayer.id,
                        status: 'pending',
                        message
                    }]);

                // Wyślij pakiet do zaproszonego gracza
                broadcastFriendUpdate(req.gameServer, req.user.id, invitedPlayer.id);
                break;

                case 'r': // respond - odpowiedz na zaproszenie
                const { i: inviteId, r: response } = d;
                
                if (!['accepted', 'rejected'].includes(response)) {
                    return res.status(400).json({ e: 'Nieprawidłowa odpowiedź' });
                }
            
                // Znajdź socket osoby, która wysłała zaproszenie
                const { data: invite } = await supabase
                    .from('friends')
                    .select('user_id')
                    .eq('id', inviteId)
                    .single();
            
                await supabase
                    .from('friends')
                    .update({ status: response })
                    .eq('id', inviteId)
                    .eq('friend_id', req.user.id);
            
                // Dodajmy logi debugowania
                console.log('Wysyłanie aktualizacji do:', {
                    currentUser: req.user.id,
                    invitingSender: invite.user_id,
                    gameServer: !!req.gameServer,
                    clientsCount: req.gameServer?.clients?.length
                });
            
                // Wyślij pakiet do obu graczy
                broadcastFriendUpdate(req.gameServer, req.user.id, invite.user_id);
            
                break;

            case 'd': // delete - usuń znajomego
                const { f: friendId } = d;
                
                // Przed usunięciem, pobierz ID drugiego użytkownika
                const { data: friendshipDetails } = await supabase
                    .from('friends')
                    .select('user_id, friend_id')
                    .eq('id', friendId)
                    .single();

                if (!friendshipDetails) {
                    return res.status(404).json({ e: 'Nie znaleziono relacji' });
                }

                // Znajdź ID drugiego użytkownika
                const otherUserId = friendshipDetails.user_id === req.user.id 
                    ? friendshipDetails.friend_id 
                    : friendshipDetails.user_id;

                // Usuń relację
                await supabase
                    .from('friends')
                    .delete()
                    .eq('id', friendId);

                // Wyślij powiadomienie do usuniętego znajomego
                broadcastFriendUpdate(req.gameServer, req.user.id, otherUserId);

                break;

            case 'u': // update - aktualizuj status online
            await supabase
            .from('users')
            .update({ 
                is_online: !d?.offline, // jeśli d.offline jest true, to ustaw is_online na false
                last_seen: new Date()
            })
            .eq('id', req.user.id);
    
        // Powiadom znajomych o zmianie statusu
        broadcastFriendUpdate(req.gameServer, req.user.id);
                break;

            default:
                return res.status(400).json({ e: 'Nieprawidłowa akcja' });
        }

        res.json({ s: 1 });
    } catch (error) {
        console.error('Błąd API przyjaciół:', error);
        if (error.message.includes('undefined')) {
            return res.status(401).json({ e: 'Musisz być zalogowany' });
        }
        res.status(500).json({ e: 'Błąd serwera' });
    }
});

module.exports = router;