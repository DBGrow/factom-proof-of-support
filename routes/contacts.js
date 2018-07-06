var crypto = require('crypto');
var NodeRSA = require('node-rsa');

var {Entry} = require('factom/src/entry');
var {Chain} = require('factom/src/chain');

var util = require('./util');

var cli = util.getFactomCli();

var contacts = [];

function init(app) {

    //load contacts from config
    var configContacts = util.getConfig().contacts;

    if (configContacts) {
        console.log('Found ' + configContacts.length + ' Contacts in JSON!');

        configContacts.forEach(function (contact) {
            //try to parse their public key
            var public_key = new NodeRSA();
            public_key.importKey(contact.public_key, 'public');
        });
    }

    //initialize the contact chain
    initContactsChain();

    //set routes
    app.get('/contacts', function (req, res) {
        getContacts(function (err, contacts) {
            if (err) {
                console.error(err);
                res.status(500).send(err.message);
                return;
            }

            res.send(JSON.stringify(contacts));
        });
    });
}

function commitAllContacts() {
    console.log("attempting to commit contacts!");

    //get all existing elements of the Contact chain

    getContacts(function (err, allContacts) {
        if (err) {
            console.error(err);
            return;
        }


        contacts = allContacts;

        //check if the contact from JSON exists, if not then commit it
        if (util.getConfig().contacts) {

            util.getConfig().contacts.forEach(function (configContact) {

            //try to find the exact contact in JSON, if it cant be found then commit it
            if (!allContacts.find(function (contact) {
                return JSON.stringify(configContact) == JSON.stringify(contact); //a bug is happening here that causes Array.includes and other methods to fail! Thus the strange comparison
            })) {
                console.log("committing: " + JSON.stringify(configContact));
                commitContact(configContact);
            } else {
                console.log("No new contacts to commit");
            }
        });
        }
    });


}

function commitContact(contact) {

        //set up signing
        var nonce = crypto.randomBytes(16).toString('hex');

        //sign this contact entry with the support app's admin private key
    var signed_nonce = util.getSupportPrivateKey().sign(nonce, 'hex', 'utf8').toString();

        //this will be the content of our signed entries!
        var content = {
            type: 'contact',
            contact: contact,
            public_key: contact.public_key,
            nonce: nonce,
            signed_nonce: signed_nonce,
        };

        //write an entry to the chain!

    console.log("chain exists! Writing entry...");

        var new_entry = Entry.builder()
            .chainId(util.getContactChainId())
            .extId('' + new Date().getTime(), 'utf8')
            .content(JSON.stringify(content), 'utf8')
            .build();

        console.log(new_entry);

    cli.addEntry(new_entry, util.getConfig().factom_es).then(function (entry) {
        console.log('Published new contact entry!');
            console.log(entry);

            // if (callback) callback(undefined, entry);
        }).catch(function (err) {
            console.error(err);

            if (callback) callback(err);
            else console.error(err);
        });
}

function initContactsChain() {

    var contactChainId = util.getContactChainId();
    console.log('Checking if Contacts chain with id ' + contactChainId + ' exists');

    //check if this chain exists already!
    cli.chainExists(contactChainId).then(function (exists) {
        if (exists) {
            console.log('Contact chain already exists!');

            //attempt to commit all contacts
            commitAllContacts();

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
            message: "This is the beginning of DBGrow's Factom Support contacts chain! Support staff's names/info and signatures will be posted here. Each entry will be signed by the public key in this entry's counterpart"
        };

        //create the chain
        var contact_chain_ext_id = crypto.createHash('md5').update(util.getSalt() + 'dbgrow_support:contacts').digest('hex');

        var new_entry0 = Entry.builder()
            .extId(new Buffer(contact_chain_ext_id), 'utf8')
            .content(JSON.stringify(content), 'utf8')
            .build();

        console.log(new_entry0);
        console.log(new_entry0.content.toString('utf8'));

        var new_chain = new Chain(new_entry0);

        cli.addChain(new_chain, util.getConfig().factom_es).then(function (chain) {
            console.log('Published new contacts chain!:');
            console.log(chain);

            console.log('Waiting 10 minutes then committing ' + util.getConfig().contacts ? util.getConfig().contacts.length : 0 + ' contacts');
            
            //wait 10 minutes, then commit the contacts

            setTimeout(function () {
                commitAllContacts();
            }, 60000 * 10);

        }).catch(function (err) {
            console.error(err);
        })

    }).catch(function (err) {
        console.error(err);
    });
}

function getContacts(callback) {
    util.getFactomdCache().getAllChainEntries(util.getContactChainId(), function (err, entries) {
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
        });

        entries = entries.map(function (entry) {
            //convert to JSON from hex string
            return JSON.parse(util.hex2ascii(entry.content))
        });


        // console.log(JSON.stringify(entries));

        var metaEntry = entries.shift(); //shift off meta entry

        var publicKey = metaEntry.support_app_public_key;
        if (!publicKey) {
            if (callback) callback(new Error("Cant verify against nonexistent public support key!"));
            else console.log("Cant verify against nonexistent public support key!");
            return;
        }

        //verify cryptographically
        entries = entries.filter(function (entry) {
            try {
                return util.getSupportPublicKey().verify(entry.nonce, entry.signed_nonce, 'utf8', 'hex');
            } catch (e) {
                console.log(e);
                return false;
            }
        });

        //map entries to contacts
        entries = entries.map(function (entry) {
            //convert to JSON from hex string
            return entry.contact
        });

        //convert to set for uniqueness
        entries = new Set(entries);

        //back to array
        entries = Array.from(entries);

        if (callback) callback(undefined, entries);
    });
}

module.exports = {
    init: init,
    getAllContacts: function () {
        return contacts
    }
};