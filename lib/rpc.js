var callbackCorrelator = require('./callbackCorrelator');

module.exports = {
  server: function(channel, consumer, cb) {
    return function rpcConsumer(message) {
      var options = {
        correlationId: message.properties.correlationId
      };

      var replyTo = message.properties.replyTo;
      consumer(message, function(err, response) {
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
    };
  },
  client: function(channel, exchange, options, cb) {
    options = options || {};
    var replyQueue;
    var correlator = callbackCorrelator();

    channel.assertQueue('', {autoDelete: true, noAck: true}, function(err, qok) {
      replyQueue = qok.queue;

      function reply(message) {
        var correlationId = message.properties.correlationId;
        var headers = message.properties.headers;
        if (headers.isError) {
          var code = headers.errorCode;
          var errorMessage = headers.errorMessage;

          return correlator.route(correlationId, new Error(errorMessage || 'amqp rpc failed'));
        }
        var payload = message.content.toString('utf-8');
        correlator.route(correlationId, null,  JSON.parse(payload));
      }

      channel.consume(replyQueue, reply, {}, function(err) {

        channel.on('return', function(message) {
          var error = new Error("No rpc consumer found for message");
          correlator.route(message.properties.correlationId, error);
        });

        cb(null, {
          request: function(routingKey, message, cb) {
            var correlationId = correlator.register(cb);

            if (options.timeoutMilliseconds) {
              setTimeout(function() {
                correlator.route(correlationId, new Error('request expired: ' + routingKey));
              }, options.timeoutMilliseconds);
            }

            var amqpArgs = {
              correlationId: correlationId,
              replyTo: replyQueue,
              mandatory: true
            };

            channel.publish(exchange, routingKey, new Buffer(JSON.stringify(message), 'utf8'), amqpArgs);
          }
        });
      });
    });
  }
};
