const crypto = require('crypto');

window.encrypt = function (text, iv, key) {
    let cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key), Buffer.from(iv, 'hex'));
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return encrypted.toString('hex');
}

window.randomBytes = function(size) {
    return crypto.randomBytes(size);
}