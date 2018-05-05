//config
var chain_salt = '';
var app_id = '';
var crypto = require('crypto');

var nonces = new Set();
module.exports = function (app) {
    app.get('/nonce', function (req, res) {
        var nonce = crypto.randomBytes(16).toString('hex');

        // console.log('SERVER: Generated nonce: ' + nonce);
        nonces.add(nonce);
        res.send(nonce);
    });
};

module.exports.doesNonceExist = function (nonce) {
    return nonces.has(nonce);
}

module.exports.expireNonce = function (nonce) {
    return nonces.delete(nonce);
}

module.exports.getSalt = function () {
    return chain_salt
};

module.exports.setSalt = function (salt) {
    chain_salt = salt;
};

module.exports.getAppID = function () {
    return app_id
};

module.exports.setAppID = function (id) {
    app_id = id;
};

