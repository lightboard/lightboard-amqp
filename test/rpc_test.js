var assert = require('assert');
var amqp = require('../lib');
var config = require('./config');
var expect = require('chai').expect;

describe('amqp rpc', function() {
  var rpc;
  var channel;

  beforeEach(function(done) {
    amqp.initWithChannel(config, function(err, ch) {
      if (err) {return done(err);}
      channel = ch;
      channel.rpcClient(function(err, r) {
        rpc = r;
        done(err);
      });
    });
  });


  afterEach(function(done) {
    channel.connection.close(done);
    channel = null;
  });

  it('fails fast if nobody is listening', function(done) {
    rpc.request('test.timeout', {}, function(err) {
      assert(err.message.length);
      done();
    });
  });

  it('can echo', function(done) {
    function echo(message, cb) {
      cb(null, message.data);
    }

    channel.rpcServer('echo.rpc', 'ping', echo, function(err) {
      if (err) { return done(err); }
      rpc.request('ping', {'foo':'bar'}, function(err, response) {
        if (err) {return done(err);}
        expect(response.foo).to.equal('bar');
        done();
      });
    });
  });

  it('handles errors', function(done) {
    function error(message, cb) {
      cb(new Error('failed!'));
    }

    channel.rpcServer('error.rpc', 'error', error, function(err) {
      if (err) { return done(err); }
      rpc.request('error', {'foo':'bar'}, function(err, response) {
        if (!err) {return done(new Error('expected error'));}
        done();
      });
    });
  });

  describe('timeouts', function() {
    it('times out if no response', function(done) {
      channel.rpcClient(function(err, client) {
        if (err) { return done(err); }
        rpc.request('test.timeout', {}, function(err) {
          expect(err).to.be;
          done();
        });
      });
    });

  });
});
