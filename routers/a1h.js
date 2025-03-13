const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { createClient } = require('@supabase/supabase-js');
const session = require('express-session');


const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

router.use(session({
    secret: process.env.SESSION_SECRET || 'tajny_klucz',
    resave: false,
    saveUninitialized: true
}));

router.post('/register', async (req, res) => {
    const { nick, password, email, captcha } = req.body;

    try {
        // Sprawdź czy mamy wszystkie dane
        if (!nick || !password || !email || !captcha) {
            return res.status(400).json({ error: 'Wypełnij wszystkie pola' });
        }

        // Sprawdź captcha
        if (!req.session.captcha || req.session.captcha.toLowerCase() !== captcha.toLowerCase()) {
            return res.status(400).json({ error: 'Nieprawidłowy kod captcha' });
        }

        // Usuń wykorzystany kod captcha
        delete req.session.captcha;

        // Sprawdź czy nick jest już zajęty
        const { data: existingUser } = await supabase
            .from('users')
            .select('nick')
            .eq('nick', nick)
            .single();

        if (existingUser) {
            return res.status(400).json({ error: 'Ten nick jest już zajęty' });
        }

        // Zahaszuj hasło
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Wygeneruj UUID zamiast hex stringa
        const userHash = require('crypto').randomUUID();

        // Utwórz nowego użytkownika
        const { data: newUser, error } = await supabase
            .from('users')
            .insert([
                {
                    nick,
                    email,
                    password: hashedPassword,
                    userHash,
                    level: 1,
                    points: 0
                }
            ])
            .select()
            .single();

        if (error) {
            console.error('Błąd rejestracji:', error);
            return res.status(500).json({ error: 'Wystąpił błąd podczas rejestracji' });
        }

        // Ustaw ciasteczka
        res.cookie('userHash', userHash, {
            httpOnly: false,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 31536000000 // rok
        });

        res.cookie('userNick', nick, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 31536000000
        });

        // Zwróć dane nowego użytkownika
        res.json({
            success: true,
            user: {
                id: newUser.id,
                nick: newUser.nick,
                level: newUser.level,
                points: newUser.points
            }
        });

    } catch (error) {
        console.error('Błąd rejestracji:', error);
        res.status(500).json({ error: 'Wystąpił błąd serwera' });
    }
});

router.post('/login', async (req, res) => {
    const { nick, password } = req.body;

    console.log('Próba logowania:', nick); // Debug

    try {
        // Sprawdź czy mamy wszystkie dane
        if (!nick || !password) {
            return res.status(400).json({ error: 'Wypełnij wszystkie pola' });
        }

        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('nick', nick)
            .single();

        console.log('Znaleziony użytkownik:', user ? 'tak' : 'nie'); // Debug

        if (error || !user) {
            return res.status(400).json({ error: 'Nieprawidłowy nick lub hasło' });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        console.log('Hasło poprawne:', validPassword); // Debug

        if (!validPassword) {
            return res.status(400).json({ error: 'Nieprawidłowy nick lub hasło' });
        }

        if (req.gameServer) {
            const playerSockets = req.gameServer.clients.filter(client => 
                client.playerTracker.name === user.nick
            );

            // Ustaw userInfo dla wszystkich socketów tego gracza
            playerSockets.forEach(socket => {
                socket.playerTracker.userInfo = {
                    id: user.id,
                    nick: user.nick
                };
                console.log('[Friends] Ustawiono userInfo dla gracza:', {
                    nick: user.nick,
                    id: user.id
                });
            });
        }

        // Ustaw ciasteczka
        res.cookie('userHash', user.userHash, {
            httpOnly: false,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 31536000000 // rok
        });

        res.cookie('isLogged', 'true', {
            httpOnly: false,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 31536000000 // rok
        });

        res.cookie('userNick', user.nick, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 31536000000
        });

        // Zwróć dane użytkownika
        res.json({
            success: true,
            user: {
                id: user.id,
                nick: user.nick,
                level: user.level,
                points: user.points
            }
        });

    } catch (error) {
        console.error('Błąd logowania:', error);
        res.status(500).json({ error: 'Wystąpił błąd serwera' });
    }
});

router.get('/check', async (req, res) => {
    const userHash = req.cookies.userHash;
    
    if (!userHash) {
        return res.status(401).json({ error: 'Nie jesteś zalogowany' });
    }

    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('id, nick, level, points')
            .eq('userHash', userHash)
            .single();

        if (error || !user) {
            res.clearCookie('userHash');
            res.clearCookie('userNick');
            return res.status(401).json({ error: 'Sesja wygasła' });
        }

        res.json({
            success: true,
            user: {
                id: user.id,
                nick: user.nick,
                level: user.level,
                points: user.points
            }
        });
    } catch (error) {
        console.error('Błąd sprawdzania sesji:', error);
        res.status(500).json({ error: 'Wystąpił błąd serwera' });
    }
});

// Endpoint do wylogowania
router.post('/logout', (req, res) => {
    res.clearCookie('userHash');
    res.clearCookie('userNick');
    res.json({ success: true });
});

module.exports = router;