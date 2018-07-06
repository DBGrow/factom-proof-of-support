var crypto = require('crypto');
var NodeRSA = require('node-rsa');

var util = require('./util');

var cli = util.getFactomCli();
var {Entry} = require('factom/src/entry');
var {Chain} = require('factom/src/chain');

var contacts = require('./contacts');

function init(app) {

    //initialize the checkin chain
    initCheckinChain();

    //commit a checkin
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

        util.expireNonce(nonce); //expire the nonce!

        //find a contact which conforms to this signed message if one exists
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
}

function commitSupportCheckin(signer, nonce, signed_nonce, message, callback) {
    var support_chain_id = util.getSupportChainId();
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

        cli.addEntry(new_entry, util.getConfig().factom_es).then(function (entry) {
            console.log('Published new support entry!');
            console.log(entry);

            if (callback) callback(undefined, content);
        }).catch(function (err) {
            console.error(err);

            if (callback) callback(err);
        });

    }).catch(function (err) {
        console.error(err);
        if (callback) callback(err);
        else console.error(err);
    })
}

function initCheckinChain() {
    var checkinChainId = util.getSupportChainId();
    console.log('Checking if Checkin chain with id ' + checkinChainId + ' exists');

//check if this chain exists already!
    cli.chainExists(checkinChainId).then(function (exists) {
        if (exists) {
            console.log('Checkin chain already exists!');
            return;
        }

        console.log('Chain does not exist! Creating:');

        //set the keys for the new support chain's root key.
        // Administrative actions such as adding contact signatures will be authenticated
        // using signed material from this public key's counterpart

        var nonce = crypto.randomBytes(16).toString('hex');

        var signed_nonce = util.getSupportPrivateKey().sign(nonce, 'hex', 'utf8').toString();

        //this will be the content of our signed entries!
        var content = {
            type: 'meta',
            support_app_public_key: util.getSupportPublicKey().exportKey('public'),
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

        cli.addChain(new_chain, util.getConfig().factom_es).then(function (chain) {
            console.log('Published new support checkin chain!:');
            console.log(chain)
        }).catch(function (err) {
            console.error(err);
            console.error(err);
        })


    }).catch(function (err) {
        console.error(err);
    })
}

function getRecentCheckins(callback) {

    //get 25 recent entries from the chain cache
    util.getFactomdCache().getLatestChainEntries(util.getSupportChainId(), 25, function (err, entries) {
        if (err) {
            if (err.message.includes('not yet included in directory block')) {
                if (callback) callback(undefined, []);
                return;
            }

            if (callback) callback(err);
            else console.error(err);
            return;
        }

        //convert cached entries into final form
        entries = entries.filter(function (entry) {
            //validate JSON parseability
            try {
                JSON.parse(util.hex2ascii(entry.content));
                return true;
            } catch (e) {
                return false;
            }
        }).map(function (entry) {
            //convert to JSON hrom hex string
            return JSON.parse(util.hex2ascii(entry.content))
        });

        //eliminate invalid entries cryptographically
        entries = filterValidEntries(entries);

        if (callback) callback(undefined, entries);
    });
}

function filterValidEntries(entries) {
    return entries.filter(function (entry) {

        //find the contact which conforms to this signed message
        return contacts.getAllContacts().find(function (contact) {
            try {
                // console.log(contact.name);
                if (!contact.public_key || contact.public_key.length == 0) return false;

                let public_key = new NodeRSA();
                public_key.importKey(contact.public_key, 'public');
                // console.log(contact.public_key);
                return public_key.verify(entry.nonce, entry.signed_nonce, 'utf8', 'hex');
            } catch (e) {
                return false;
            }
        });
    });
}

module.exports = {
    init: init,
    initCheckinChain: initCheckinChain
};