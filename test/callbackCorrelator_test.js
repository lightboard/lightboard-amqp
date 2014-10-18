var callback_correlator = require('../lib/callbackCorrelator');
var expect = require('chai').expect;

describe('callbackCorrelator', function() {
  var correlator;

  beforeEach(function() {
    correlator = callback_correlator();
  });

  it('invokes the correct callback', function() {
    var invoked = false;
    var id1 = correlator.register(function() {
      invoked = true;
    });
    correlator.route(id1);
    expect(invoked).to.equal(true);
  });

  it('does not invoke other callbacks', function() {
    var invoked = false;
    correlator.register(function() {
      invoked = true;
    });
    correlator.route(42);
    expect(invoked).to.equal(false);
  });

  it('only invokes the callback once', function() {
    var cbCount = 0;
    var id1 = correlator.register(function() {
      cbCount++;
    });
    correlator.route(id1);
    correlator.route(id1);
    expect(cbCount).to.equal(1);
  });

  it('only invokes callback with matching cid', function() {
    var cb1Count = 0;
    var cb2Count = 0;

    var id1 = correlator.register(function() {
      cb1Count++;
    });

    correlator.register(function() {
      cb2Count++;
    });
    correlator.route(id1);
    expect(cb1Count).to.equal(1);
    expect(cb2Count).to.equal(0);
  });

  it('passes along the args to the callback', function() {
    var args;
    var id1 = correlator.register(function() {
      args = [].slice.apply(arguments);
    });
    correlator.route(id1, 'foo', 'bar');
    expect(args[0]).to.equal('foo');
    expect(args[1]).to.equal('bar');
  });
});
