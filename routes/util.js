//config
var chain_salt = '';
var app_id = '';
var app_name = '';
var crypto = require('crypto');

var {Entry} = require('factom/src/entry');
var {Chain} = require('factom/src/chain');

//factom stuff
var {FactomCli} = require('factom');

//se

var {FactomdCache} = require('factomd-cache');

try {
    var config = require('../config');
} catch (e) { //if config cant be found or syntax err
    throw e;
}

console.log('config:');
console.log(config);

chain_salt = config.salt;
app_id = config.support_app_id;
app_name = config.support_app_name;



var fs = require('fs');
var NodeRSA = require('node-rsa');


//check that we have the private and public keys
if (!fs.existsSync('./keys/key.pem') && !fs.existsSync('./keys/public.pem')) {
    console.log('PK didnt exist! Generating...');
    var privateKey = new NodeRSA({b: 2048});

    //write the key files
    fs.writeFileSync('./keys/key.pem', privateKey.exportKey('private'));
    fs.writeFileSync('./keys/public.pem', privateKey.exportKey('public'));

    supportPrivateKey = new NodeRSA();
    supportPrivateKey.importKey(privateKey.exportKey('private'), 'private');

    supportPublicKey = new NodeRSA();
    supportPublicKey.importKey(privateKey.exportKey('public'), 'public');
} else {
    console.log('Keys exist! Reading from files...');

    try {
        var privKeyString = fs.readFileSync('./keys/key.pem').toString();
        var pubKeyString = fs.readFileSync('./keys/public.pem').toString();


        supportPrivateKey = new NodeRSA();
        supportPrivateKey.importKey(privKeyString, 'private');

        supportPublicKey = new NodeRSA();
        supportPublicKey.importKey(pubKeyString, 'public');
    } catch (e) {
        throw e;
    }
}

var supportPrivateKey;
var supportPublicKey;


var nonces = new Set();
module.exports = function (app) {
    app.get('/nonce', function (req, res) {
        var nonce = crypto.randomBytes(16).toString('hex');
        nonces.add(nonce);
        res.send(nonce);
    });

    app.get('/name', function (req, res) {
        res.send(module.exports.getAppName())
    })
};

module.exports.getConfig = function () {
    return config;
};

module.exports.doesNonceExist = function (nonce) {
    return nonces.has(nonce);
};


module.exports.expireNonce = function (nonce) {
    return nonces.delete(nonce);
};

module.exports.getSalt = function () {
    return chain_salt
};


module.exports.getAppID = function () {
    return app_id
};

module.exports.getAppName = function () {
    return app_name
};


module.exports.getFactomdCache = function () {
    return factomdCache;
};

module.exports.getSupportChainId = function () {
    return new Chain(Entry.builder()
        .extId(new Buffer(crypto.createHash('md5').update(module.exports.getSalt() + 'dbgrow_support').digest("hex"), 'utf8'))
        .build()).id.toString('hex')
};

module.exports.getContactChainId = function () {
    return new Chain(Entry.builder()
        .extId(new Buffer(crypto.createHash('md5').update(module.exports.getSalt() + 'dbgrow_support:contacts').digest("hex"), 'utf8'))
        .build()).id.toString('hex')
};

module.exports.getFactomCli = function () {
    return cli;
};

module.exports.hex2ascii = function (hexx) {
    var hex = hexx.toString();//force conversion
    var str = '';
    for (var i = 0; (i < hex.length && hex.substr(i, 2) !== '00'); i += 2)
        str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
    return str;
};

module.exports.getSupportPrivateKey = function () {
    return supportPrivateKey;
};

module.exports.getSupportPublicKey = function () {
    return supportPublicKey;
};

//setup factom
var cli = new FactomCli({
    factomd: {
        host: module.exports.getConfig().factomd_api_host ? module.exports.getConfig().factomd_api_host : 'localhost',
        port: module.exports.getConfig().factomd_api_port ? module.exports.getConfig().factomd_api_port : 8088
    },
    walletd: {
        host: module.exports.getConfig().walletd_api_host ? module.exports.getConfig().walletd_api_host : 'localhost',
        port: module.exports.getConfig().walletd_api_port ? module.exports.getConfig().walletdd_api_port : 8089
    }
});

//configure cache
var factomdCache = new FactomdCache({
    factomdParams: { //see https://www.npmjs.com/package/factom#instantiate-factomcli

        factomd: {
            host: module.exports.getConfig().factomd_api_host ? module.exports.getConfig().factomd_api_host : 'localhost',
            port: module.exports.getConfig().factomd_api_port ? module.exports.getConfig().factomd_api_port : 8088
        }
    }
});