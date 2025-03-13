const express = require('express');
const router = express.Router();

router.get('/battle-modal', async (req, res) => {
    try {
        const settings = {
            mode: req.query.mode || '2v2',
            region: 'Oceania',
            queue: '~1 minute',
            status: 'Finding a game',
            reward: '1.5 pt',
            if_defeated: '-0.7 pt'
        };

        res.render('battle-modal', {
            settings,
            user: req.user
        });
    } catch (error) {
        console.error('Błąd podczas generowania modalu battle:', error);
        res.status(500).send('Wystąpił błąd podczas ładowania modalu');
    }
});


router.post('/battle/players', async (req, res) => {
    try {
        const { action, playerId } = req.body;
        
        switch(action) {
            case 'invite':
                // Logika zapraszania gracza
                break;
            case 'remove':
                // Logika usuwania gracza
                break;
            // inne akcje...
        }
        
        // Zwróć aktualną listę graczy
        const players = [/* aktualna lista graczy */];
        res.json({ success: true, players });
        
    } catch (error) {
        console.error('Błąd podczas zarządzania graczami:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Wystąpił błąd podczas zarządzania graczami' 
        });
    }
});

module.exports = router;