'use strict';

var amqp = require('../lib');

var async = require('async')
var chai = require('chai')
var expect = chai.expect;

var config = require('./config');

describe('amqp', function () {
  var channel;
  var connection;

  beforeEach(function(done) {
    amqp.init(config, function(err, c) {
      if (err) {
        return done(err);
      }
      connection = c;
      connection.createChannel(function(err, ch) {
        channel = ch;
        done(err, ch);
      });
    });
  });

  afterEach(function(done) {
    connection.close(done);
    connection = null;
  });

  describe('pub/sub', function() {
    it('can publish and subscribe', function(done) {
      function consumer(message) {
        expect(message.data.answer).to.equal(42);
        done();
      }

      channel.subscribe('foo', consumer, function(err) {
        if (err) { return done(err); }
        channel.publish('foo', {answer: 42});
      });
    });

    it('supports topic routing', function(done) {
      channel.subscribe('foo.*', function(message) {
        expect(message.data.baz).to.equal(77);
        done();
      }, function publish(cb) {
        channel.publish('foo.bar', {baz: 77});
      });
    });

    it('can publish to multiple consumers', function(done) {
      // one per channel
      var received = [false, false];

      channel.subscribe('foo', consumer(0), function() {
        //subscribe on a separate channel
        connection.createChannel(function(err, otherChannel) {
          if (err) { return done(err); }
          otherChannel.subscribe('foo', consumer(1), publish);
        });
      });

      function consumer(index) {
        return function(message) {
          received[index] = true;
          if (received[0] && received[1]) {
            done();
          }
        }
      }

      function publish(err) {
        channel.publish('foo', {answer: 42});
      }
    });

    it('can have multiple subscriptions on the same channel', function(done) {
      // one per subscriber
      var received = [false, false];

      // subscribe to the same routing key twice
      channel.subscribe('foo', consumer(0), function(err) {
        if (err) { return done(err); }
        channel.subscribe('foo', consumer(1), publish);
      });

      function consumer(index) {
        return function(message) {
          received[index] = true;
          if (received[0] && received[1]) {
            done();
          }
        }
      }

      function publish(err) {
        channel.publish('foo', {answer: 42});
      }
    });
  });

  describe('workers', function() {
    it('can have a single worker', function(done) {
      channel.worker('questions', 'question.ask', function(message) {
        done();
      }, function(err) {
        if (err) { return done(err); }
        channel.publish('question.ask', {});
      });
    });

    it('round robins with multiple workers', function(done) {
      var received = [false, false, false];
      function consumer(index) {
        return function(message) {
          received[index] = true;
          if (received[0] && received[1] && received[2]) {
            done();
          }
        }
      }

      channel.worker('questions', 'question.ask', consumer(0), function(err) {
        channel.worker('questions', 'question.ask', consumer(1), function(err) {
          channel.worker('questions', 'question.ask', consumer(2), function(err) {
            if (err) { return done(err); }
            channel.publish('question.ask', {});
            channel.publish('question.ask', {});
            channel.publish('question.ask', {});
          });
        });
      });
    });
  });
});
