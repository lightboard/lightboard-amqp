'use strict';
var amqp = require('amqplib/callback_api');
var rpc = require('./rpc');
var connection = require('./connection');

module.exports = {
  init: amqpInit,
  initWithChannel: function(config, cb) {
    amqpInit(config, function(err, connection) {
      if (err) { return cb(err); }
      connection.createChannel(cb);
    });
  }
};

function amqpInit(config, cb) {
  var amqpUrl = config.amqpUrl;

  function fail(err) {
    console.warn('failed to init amqp:', err);
    cb(err);
  }

  amqp.connect(amqpUrl, function(err, conn) {
    if (err) { return fail(err); }

    cb(null, connection(conn, config.amqpExchange));
  });
}

