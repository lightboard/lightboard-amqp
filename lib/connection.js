var channel = require('./channel');

module.exports = function wrapConnection(connection, exchange) {
  return {

    createChannel: function(cb) {
      connection.createChannel(function(err, ch) {
        if (err) { return cb(err); }
        ch.assertExchange(exchange, 'topic', {},  function(err) {
          if (err) { return cb(err); }
          var wrapped = channel(ch, exchange);
          wrapped.connection = connection;
          cb(null, wrapped);
        });
      });
    },

    close: connection.close.bind(connection)
  };
}

