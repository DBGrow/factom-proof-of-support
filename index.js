//basic setup, handle keys etc.
var util = require('./routes/util');

const express = require('express');
const app = express();

//distribute express app down to routes/endpoints
require('./routes/router')(app);

//and start listening for connections
app.listen(3000, function () {
    console.log('Example app listening on port 3000!')
});

//default setup
//cache our checkin & contact chains
util.getFactomdCache().cacheChain(util.getSupportChainId());
util.getFactomdCache().cacheChain(util.getContactChainId());




