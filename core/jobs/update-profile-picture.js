/*jslint node: true */
'use strict';

/* system libs */
var moment = require('moment');

/* app libs */
var queue = require('../lib/queue');
var helpers = require('../lib/helpers')();

/* database models */
var Fanpage = require('../models/fanpage');
var Album = require('../models/album');

/* constantes */
var timeout = 1;
var lastRun = 0;
var nextRun = moment().unix();

/* job tasks */

/* add page info to the queue */
var syncProfilePicture = function(page) {
    Album.findOne({ ref: page._id, type: 'profile' }, function (err, one) {
        if (one) {
            var url = one._id + '/photos';
            var args = 'limit=1';
            queue.add(page, url, 'limit=1', syncProfilePictureCallback, [ 'images{source}' ], profilePictureErrorCallback);
        }
    });
}

/* parse page info callback response */
var syncProfilePictureCallback = function(page, row) {
    if (row.data && row.data.length > 0) {
        var images = row.data[0].images;
        
        if (images && images.length > 0) {
            var savepic = images[images.length - 1].source;

            Fanpage.update({ _id: page._id }, {
                /* profile picture */
                'facebook.picture': savepic,

                /* job status */
                'jobs.update_profile_picture': Date.now()
            }, function(err) {
                if (err) {
                    throw 'Error updating output from sync profile picture: ' + err;
                }
            });
        }
    }
};

/* parse error conditions */
var profilePictureErrorCallback = function(page, relative_url, error) {
    var info = {
        time: Date.now(),
        request: relative_url,
        error: JSON.stringify(error)
    };
    
    Fanpage.update({ _id: page._id }, { error: info }, function(err) {
        if (err) {
            console.log('---------- ERROR: Failed to log error info! ----------------');
            console.log(info);
            console.log('-------');
        }
    });
}

/* start syncing page contents */
var startSyncing = function (records, callback) {
    var i,
        cur;
    
    if (!callback) {
        throw 'No callback has been supplied for "startSyncing"';
    }
    
    for (i = 0; i < records.length; i += 1) {
        cur = records[i];
        syncProfilePicture(cur);
    }
};

/* job interface */
var job = {
    
    /* job name */
    jobName: 'Update profile picture',
    
    /* expose timeout */
    nextRun: function () {
        return nextRun;
    },
    
    /* check if job must be run */
    checkConditions: function (callback) {
        if (!callback) {
            throw 'No callback has been supplied for "checkConditions"!';
        }

        Fanpage.find({ $and: [ { 'billing.expiration': { $gt: new Date() } }, { 'error': { $exists: false } }, { 'jobs.new_site_created': { $exists: true, $ne: null }, $or: [ { 'jobs.update_profile_picture': { $exists: false } }, { 'jobs.update_profile_picture': { $lt: new Date((new Date()) - (1000 * 60 * 10)) } } ] } ] }, function (err, records) {
            if (err) {
                console.log('Database error: ' + err);
            } else {
                var status = (records && records.length !== 0);
                callback(job, status, records);
            }
        });
    },
    
    /* trigger job's work */
    doWork: function (records, callback) {
        nextRun = moment().unix() + timeout;
        startSyncing(records, callback);
    }
    
};

module.exports = job;