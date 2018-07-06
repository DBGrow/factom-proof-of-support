module.exports = function (app) {
    //initialize our express routes!
    require('./util')(app);
    require('./checkin').init(app);
    require('./contacts').init(app);
};