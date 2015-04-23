'use strict';

var currentLanguage = require('../../lib/current-language');
var Fanpage = require('../../models/fanpage');

module.exports = function (router) {

    router.get('/', function (req, res) {
        
        if (!req.isAuthenticated()) {
            res.redirect('/');
        } else {
            var model = currentLanguage(req);
            model.user = req.user;
            res.render('admin', model);
        }
    });

};
