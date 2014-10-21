var rpc = require('./rpc');
module.exports = function wrapChannel(channel, exchange) {
  return {
    close: channel.close.bind(channel),
    // multiple consumers of same message
    subscribe: function(pattern, consumer, cb) {
      bindConsumer('', pattern, {autoDelete: true}, consumer, cb);
    },
    // one worker per message, round robin with a named queue
    worker: function(name, pattern, consumer, cb) {
      bindConsumer(name, pattern, {durable: true, autoDelete: false}, consumer, cb);
    },
    // publish to all listeners
    publish: function(routingKey, message) {
      channel.publish(exchange, routingKey, new Buffer(JSON.stringify(message), 'utf-8'));
    },
    // request/response - the "request" side
    rpcClient: function(cb) {
      rpc.client(channel, exchange, {}, cb);
    },
    // request/response - the "response" side
    // consumer: function(name, message, cb)
    rpcServer: function(name, pattern, consumer, cb) {
      function rpcConsumer(message) {
        var options = {
          correlationId: message.properties.correlationId
        };

        var replyTo = message.properties.replyTo;
        consumer(message, function(err, response) {
          console.log('rpc - sending reply', err, response, replyTo, options);
          if (err) {
            options.headers = {
              isError: true,
              errorMessage: err
            };
            channel.publish('', replyTo, new Buffer('{}', 'utf-8'), options );
          }
          else {
            channel.publish('', replyTo, new Buffer(JSON.stringify(response), 'utf-8'), options);
          }
        });
      }
      bindConsumer(name, pattern, {durable: true, autoDelete: false}, rpcConsumer, cb);
    }
  };

  function bindConsumer(name, pattern, opts, consumer, cb) {
    channel.assertQueue(name, opts, function(err, qok) {
      if (err) { return cb(err); }
      channel.bindQueue(qok.queue, exchange, pattern, {}, function(err) {
        if (err) { return cb(err); }
        channel.consume(qok.queue, wrapConsumer(consumer),  {}, cb);
      });
    });
  }

  function wrapConsumer(consumer) {
    return function consumerWrapper(message) {
      // null sent on queue delete
      if (message === null) {
        return;
      }

      //always ack
      channel.ack(message);
      var asString = message.content.toString('utf-8');

      consumer({
        routingKey: message.fields.routingKey,
        data: JSON.parse(asString),
        ack: channel.ack.bind(channel, message),
        properties: message.properties
      });
    };
  }
}
