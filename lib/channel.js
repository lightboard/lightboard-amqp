var rpc = require('./rpc');

//
// channel is an amqp channel
// exchange is a string name of an exchange
//
module.exports = function wrapChannel(channel, exchange) {
  return {

    //
    // close the channel
    //
    close: channel.close.bind(channel),

    //
    // publish a message that will be routed to listeners whose topics match routingKey
    //
    // routingKey: amqp routing key
    // message: amqp message
    publish: function(routingKey, message) {
      channel.publish(exchange, routingKey, new Buffer(JSON.stringify(message), 'utf-8'));
    },

    //
    // multiple consumers of same message pattern
    // all receive the message
    //
    // pattern: amqp routing key name or pattern
    // consumer: function(message)
    // cb: function(err)
    subscribe: function(pattern, consumer, cb) {
      bindConsumer('', pattern, {autoDelete: true}, consumer, cb);
    },

    //
    // round robin messages to all subscribers with same name
    // one worker per message, round robin (as per rabbitmq at least)
    //
    // consumer: function(message)
    // cb: function(err)
    worker: function(name, pattern, consumer, cb) {
      bindConsumer(name, pattern, {durable: true, autoDelete: false}, consumer, cb);
    },

    //
    // request/response - the "request" side
    // sets replyTo in outgoing messages so that server can respond to correct client
    // Note that the reply happens on the default exchange
    //
    // cb: function(err, client)
    //
    // yields a client which is used like:
    //
    // client.request('routing.key', {question: '6 * 9'}, function(err, response) {
    //   console.log(response.answer);
    //   // -> 42
    // });
    //
    // Note that the request method will fail fast (yield error) if no server listening
    //
    rpcClient: function(cb) {
      rpc.client(channel, exchange, {}, cb);
    },

    //
    // request/response - the "response" side
    //
    // route response back to the client (via replyTo)
    // round robin through rpc servers with same name
    //
    // the consumer must yield (err, response) which is routed to back the caller
    //
    // consumer example:
    //
    // function(message, cb) {
    //   if (message.data.question === '6 * 9') {
    //     cb(null, {answer: 42});
    //   }
    //   else {
    //     cb(new Error("Ask me again later"));
    //   }
    // }
    //
    rpcServer: function(name, pattern, consumer, cb) {
      var rpcConsumer = rpc.server(channel, consumer);
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
};
