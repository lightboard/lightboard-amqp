##AMQP Helpers

Provides opinionated helpers for using rabbitmq for:

- Pub/sub
Each message is routed to (zero to) many listeners

- Worker
Round-robin message consumers - each message is routed to one consumer

- RPC client(producer) & server(consumer)
Each message is consumed by one server, which sends the response back to the client

Depends on amqplib.

### Notes

All messages are acked _before_ handlers are invoked.



### examples

#### publish/subscribe
```javascript

  var amqp = require('lightboard-amqp');

  // can also use amqp.init and connection.createChannel separately
  amqp.initWithChannel('amqp://localhost', function(err, channel) {

    function hello(message) {
      console.log(message.name);
    }

    channel.subscribe('hello', hello, function(err) {
      channel.publish('hello', {name: 'arthur'});
    });
  });

```

#### workers - round robin
```javascript
  var amqp = require('lightboard-amqp');

  amqp.initWithChannel('amqp://localhost', function(err, channel) {

    // workers receive alternating messages
    function sandwich(message) {
      console.log('making ' +  message.type );
    }

    function sandwichWithBacon(message) {
      console.log('making ' + message.type + ' with bacon');
    }

    channel.worker('sandwichMaker', 'sandwich', sandwich, function(err) {
      channel.worker('sandwichMaker', 'sandwich', sandwichWithBacon, function(err) {
        channel.publish('sandwich', {type: 'turkey'});
        channel.publish('sandwich', {type: 'grilled cheese'});
        channel.publish('sandwich', {type: 'roast beef'});
        channel.publish('sandwich', {type: 'vegan'});
      });
    });
  });

```

#### Remote procedue call (RPC)
```javascript
  var amqp = require('lightboard-amqp');

  amqp.initWithChannel('amqp://localhost', function(err, channel) {

    function deepThought(message, cb) {
      if (message.data.question === '6 * 9') {
        cb(null, {answer: 42});
      }
      else {
        cb(new Error("Ask me again later"));
      }
    });

    rpc.server('answers', 'question.ask', deepThought, function(err) {
      // ... handle err if set ...
      rpc.client(function(err, client) {
        // ... handle err if set ...
        client.request('question.ask', {question: '6 * 9'}, function(err, response) {
          console.log(response.answer);
          // -> 42
        });
      });
    });

  });

```
