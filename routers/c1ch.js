const { createCanvas } = require('canvas');
const express = require('express');
const router = express.Router();

router.get('/captcha', (req, res) => {
    const canvas = createCanvas(200, 80);
    const ctx = canvas.getContext('2d');
    
    const chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const length = Math.floor(Math.random() * 2) + 6;
    let captchaText = '';
    for (let i = 0; i < length; i++) {
        captchaText += chars[Math.floor(Math.random() * chars.length)];
    }
    
    const bgColor = `rgb(${220 + Math.floor(Math.random() * 35)}, ${220 + Math.floor(Math.random() * 35)}, ${220 + Math.floor(Math.random() * 35)})`;
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, 200, 80);
    
    for (let i = 0; i < 10; i++) {
        ctx.beginPath();
        
        ctx.fillStyle = `rgba(${180 + Math.floor(Math.random() * 40)}, ${180 + Math.floor(Math.random() * 40)}, ${180 + Math.floor(Math.random() * 40)}, 0.5)`;
        
        if (Math.random() > 0.5) {
            const radius = 5 + Math.random() * 15;
            ctx.arc(
                Math.random() * 200, 
                Math.random() * 80, 
                radius, 
                0, 
                Math.PI * 2
            );
        } else {
            const width = 10 + Math.random() * 30;
            const height = 10 + Math.random() * 30;
            ctx.rect(
                Math.random() * 200, 
                Math.random() * 80, 
                width, 
                height
            );
        }
        
        ctx.fill();
    }
    
    for (let i = 0; i < 20; i++) {
        ctx.beginPath();
        ctx.moveTo(Math.random() * 200, Math.random() * 80);
        ctx.lineTo(Math.random() * 200, Math.random() * 80);
        ctx.strokeStyle = `rgba(${150 + Math.floor(Math.random() * 50)}, ${150 + Math.floor(Math.random() * 50)}, ${150 + Math.floor(Math.random() * 50)}, 0.5)`;
        ctx.lineWidth = 0.5 + Math.random() * 1.5;
        ctx.stroke();
    }
    
    const safeMarginX = 25;
    const safeMarginY = 15;
    const safeWidth = 200 - (safeMarginX * 2); 
    
    const charWidth = safeWidth / captchaText.length;
    
    for (let i = 0; i < captchaText.length; i++) {
        ctx.save();
        
        const x = safeMarginX + (i * charWidth) + (charWidth / 4);
        const y = 40 + (Math.random() * 10 - 5);
        
        ctx.translate(x, y);
        ctx.rotate((Math.random() - 0.5) * 0.5); 
        
        const scaleX = 0.8 + Math.random() * 0.4; 
        const scaleY = 0.8 + Math.random() * 0.6; 
        ctx.scale(scaleX, scaleY);
        
        ctx.fillStyle = `rgb(${Math.floor(Math.random() * 80)}, ${Math.floor(Math.random() * 80)}, ${Math.floor(Math.random() * 80)})`;
        
        const fontSize = 24 + Math.floor(Math.random() * 8); 
        ctx.font = `bold ${fontSize}px sans-serif`;
        
        if (Math.random() > 0.5) {
            ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
            ctx.shadowBlur = 2 + Math.random() * 3;
            ctx.shadowOffsetX = (Math.random() - 0.5) * 2;
            ctx.shadowOffsetY = (Math.random() - 0.5) * 2;
        }
        
        ctx.fillText(captchaText[i], 0, 0);
        
        ctx.restore();
    }
    
    for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(0, 20 + Math.random() * 40);
        
        const cp1x = 50 + Math.random() * 30;
        const cp1y = Math.random() * 80;
        const cp2x = 100 + Math.random() * 50;
        const cp2y = Math.random() * 80;
        
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, 200, 20 + Math.random() * 40);
        
        ctx.strokeStyle = `rgba(${Math.floor(Math.random() * 100)}, ${Math.floor(Math.random() * 100)}, ${Math.floor(Math.random() * 100)}, 0.7)`;
        ctx.lineWidth = 1 + Math.random() * 1;
        ctx.stroke();
    }
    
    if (req.session) {
        req.session.captcha = captchaText;
    }
    
    // Wyślij obrazek
    res.writeHead(200, {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
    });
    
    canvas.createPNGStream().pipe(res);
});

module.exports = router;