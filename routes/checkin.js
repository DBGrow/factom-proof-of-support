var crypto = require('crypto');
var NodeRSA = require('node-rsa');

var fs = require('fs');

//factom stuff
var {FactomCli} = require('factom');
var cli = new FactomCli({
    factomd: {
        host: '88.200.170.90' //ilzheev (De Facto)#4781 on Discord's testnet courtesy node
    }
});
var {Entry} = require('factom/src/entry');
var {Chain} = require('factom/src/chain');

var util = require('./util');

var contacts = require('../contacts/contacts');

function init(app) {
    app.post('/checkin', function (req, res) {
        console.log(JSON.stringify(req.query));
        var nonce = req.query.nonce;
        var signed_nonce = req.query.signed_nonce;
        var message = req.query.message;

        console.log('SERVER: got nonce: ' + nonce);
        console.log('SERVER: got signed_nonce: ' + signed_nonce);

        if (!nonce || !signed_nonce) {
            res.status(403).send("Your request must include both the nonce and it's signature");
            console.error("Client request didn't include both the nonce and it's signature");
            return;
        }

        if (!util.doesNonceExist(nonce)) {
            res.status(401).send('Authentication failed! Uknown nonce');
            console.error('Authentication failed! unknown nonce!!!');
            return;
        }

        util.expireNonce(nonce) //expire the nonce!

        //find the contact which conforms to this signed message
        var signer = contacts.getAllContacts().find(function (contact) {
            console.log(contact.name);
            if (!contact.public_key || contact.public_key.length == 0) return false;

            var public_key = new NodeRSA();
            public_key.importKey(contact.public_key, 'public');
            // console.log(contact.public_key);
            return public_key.verify(nonce, signed_nonce, 'utf8', 'hex');
        });

        if (!signer) {
            res.status(401).send('Authentication failed! Could not find a signer for this signed nonce');
            console.error('Authentication failed!');
            return;
        }

        /*var public_key = new NodeRSA();
        public_key.importKey(devon_pub, 'public');

        var authentic = public_key.verify(nonce, signed_nonce, 'utf8', 'hex');
        if (!authentic) {
            res.status(401).send('Authentication failed!');
            console.error('Authentication failed!');
            return;
        }*/

        console.log('Authentication SUCCESS!');

        commitSupportCheckin(signer, nonce, signed_nonce, message, function (err, entry) {
            if (err) {
                res.status(500).send(err);
                return;
            }

            res.send(JSON.stringify(entry));
        });
    });

    //get all most recent checkins
    app.get('/checkins', function (req, res) {
        getRecentCheckins(function (err, checkins) {
            if (err) {
                res.status(500).end();
                return;
            }
            res.send(JSON.stringify(checkins)).end();
        })
    })
};

function commitSupportCheckin(signer, nonce, signed_nonce, message, callback) {
    var chain_id = 'dbgrow_support';
    var support_chain_id = getSupportChainID(chain_id);
    console.log('Checking if chain with id ' + support_chain_id + ' exists');

    //this will be the content of our signed entries!
    var content = {
        type: 'checkin',
        signer_id: signer.id,
        signer: signer.name,
        message: message,
        nonce: nonce,
        signed_nonce: signed_nonce,
        timestamp: new Date().getTime()
    };

//check if this chain exists already!
    cli.chainExists(support_chain_id).then(function (exists) {
        if (!exists) {
            console.error('Chain did not exist yet! Please create it first')
            if (callback) callback(new Error('Chain did not exist yet! Please create it first'));
            return;
        }

        //write an entry to the chain!

        console.log("chain exists! Writing entry...")

        var new_entry = Entry.builder()
            .chainId(support_chain_id.toString())
            .extId('' + new Date().getTime(), 'utf8')
            .content(JSON.stringify(content), 'utf8')
            .build();

        console.log(new_entry);

        cli.addEntry(new_entry, process.env.FACTOM_ES).then(function (entry) {
            console.log('Published new support entry!');
            console.log(entry);

            if (callback) callback(undefined, content);
        }).catch(function (err) {
            console.error(err);

            if (callback) callback(err);
            else console.error(err);
        });

        /*

                console.log('Chain does not exist! Creating:');

                //set the keys for the new support chain's root key.
                // Administrative actions such as adding contact signatures will be authenticated
                // using signed material from this public key's counterpart
                var private_support_key_string = fs.readFileSync('./keys/support/key.pem').toString();
                var public_support_key_string = fs.readFileSync('./keys/support/public.pem').toString();

                var private_support_key = new NodeRSA();
                private_support_key.importKey(private_support_key_string, 'private');

                var public_support_key = new NodeRSA();
                public_support_key.importKey(public_support_key_string, 'public');

                content.support_app_public_key = public_support_key_string.toString();
                content.support_app_signed_nonce = private_support_key.sign(nonce, 'hex', 'utf8').toString();

                console.log(JSON.stringify(content, undefined, 2));

                //create the chain
                var app_chain_ext_id = crypto.createHash('md5').update(util.getSalt() + chain_id).digest('hex');
                console.log('extid: ' + app_chain_ext_id);

                var new_entry0 = Entry.builder()
                    .extId(new Buffer(app_chain_ext_id), 'utf8')
                    .content(JSON.stringify(content), 'utf8')
                    .build();

                console.log(new_entry0);
                console.log(new_entry0.content.toString('utf8'));

                var new_chain = new Chain(new_entry0);

                cli.addChain(new_chain, process.env.FACTOM_EC).then(function (chain) {
                    console.log('Published new support chain!:');
                    console.log(chain)
                    if (callback) callback(undefined, new_entry);
                }).catch(function (err) {
                    console.error(err);
                    if (callback) callback(err);
                    else console.error(err);
                })

        */

    }).catch(function (err) {
        console.error(err);
        if (callback) callback(err);
        else console.error(err);
    })
}

function initCheckinChain(callback) {
    var chain_id = 'dbgrow_support';
    var support_chain_id = getSupportChainID(chain_id);
    console.log('Checking if chain with id ' + support_chain_id + ' exists');

//check if this chain exists already!
    cli.chainExists(support_chain_id).then(function (exists) {
        if (exists) {
            console.error('Chain already exists! Cannot initialize twice.')
            return;
        }

        console.log('Chain does not exist! Creating:');

        //set the keys for the new support chain's root key.
        // Administrative actions such as adding contact signatures will be authenticated
        // using signed material from this public key's counterpart
        var private_support_key_string = fs.readFileSync('./keys/support/key.pem').toString();
        var public_support_key_string = fs.readFileSync('./keys/support/public.pem').toString();

        //check that these exist!

        var private_support_key = new NodeRSA();
        private_support_key.importKey(private_support_key_string, 'private');

        var public_support_key = new NodeRSA();
        public_support_key.importKey(public_support_key_string, 'public');

        var nonce = crypto.randomBytes(16).toString('hex');

        var signed_nonce = private_support_key.sign(nonce, 'hex', 'utf8').toString();

        //this will be the content of our signed entries!
        var content = {
            type: 'meta',
            support_app_public_key: public_support_key_string.toString(),
            nonce: nonce,
            signed_nonce: signed_nonce,
            message: "This is the beginning of DBGrow's Factom Support checkin chain! Signed checkins from support staff will appear here"
        };

        console.log(JSON.stringify(content, undefined, 2));

        //create the chain
        var app_chain_ext_id = crypto.createHash('md5').update(util.getSalt() + 'dbgrow_support').digest('hex');
        console.log('extid: ' + app_chain_ext_id);

        var new_entry0 = Entry.builder()
            .extId(new Buffer(app_chain_ext_id), 'utf8')
            .content(JSON.stringify(content), 'utf8')
            .build();

        console.log(new_entry0);
        console.log(new_entry0.content.toString('utf8'));

        var new_chain = new Chain(new_entry0);

        cli.addChain(new_chain, process.env.FACTOM_EC).then(function (chain) {
            console.log('Published new support checkin chain!:');
            console.log(chain)
        }).catch(function (err) {
            console.error(err);
            console.error(err);
        })


    }).catch(function (err) {
        console.error(err);
        if (callback) callback(err);
        else console.error(err);
    })
}

function getRecentCheckins(callback) {
    var support_chain_id = getSupportChainID();
    // console.log('Getting recent entries for ' + support_chain_id);

//check if this chain exists already!
    cli.getAllEntriesOfChain(support_chain_id).then(function (entries) {
        // console.log(entries)
        entries = parseSupportEntries(entries);

        /*entries.forEach(function (entry) {

        })*/
        // console.log(JSON.stringify(entries, undefined, 2))

        callback(undefined, entries);
    }).catch(function (err) {
        console.error(err);
        if (callback) callback(err);
    });
}

function getSupportChainID() {
    // console.log(chain_salt + ' USING SALT');
    return new Chain(Entry.builder()
        .extId(new Buffer(crypto.createHash('md5').update(util.getSalt() + 'dbgrow_support').digest("hex"), 'utf8'))
        .build()).id.toString('hex')
}

function parseSupportEntries(raw_entries) {
    return raw_entries.map(function (entry) {
        return parseSupportEntry(entry)
    })
}

function parseSupportEntry(raw_entry) {
    var entry = JSON.parse(raw_entry.content);
    entry.timestamp = raw_entry.timestamp;
    return entry;
}

function validateParsedEntry(entry) {
    try {
        console.log('euuid: ', entry.uuid)
        console.log('esig: ', entry.uuid_sig)
        return public_key.verify(entry.uuid, entry.uuid_sig, 'utf8', 'hex');
    } catch (e) {
        console.error('\nError validating entry: ' + e.message + '\n');
        return false;
    }
}

module.exports = {
    init: init,
    initCheckinChain: initCheckinChain
}