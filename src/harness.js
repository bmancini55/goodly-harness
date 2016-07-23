
const sinon = require('sinon');
const chai  = require('chai');
const debug = require('debug')('goodly-harness');

class Harness {

  // service should not be started until
  constructor(service) {
    this.service = service;
    this.queueHandlers = {};

    this.stubAmqp = {
      connect: sinon.stub()
    };


    this.stubBroker  = {
      createChannel: sinon.stub(),
      close: sinon.stub()
    };

    this.stubAmqp.connect.returns(Promise.resolve(this.stubBroker));

    this.stubChannel = {
      assertExchange: sinon.stub().returns(Promise.resolve()),
      assertQueue: sinon.stub().returns(Promise.resolve()),
      bindExchange: sinon.stub().returns(Promise.resolve()),
      bindQueue: sinon.stub().returns(Promise.resolve()),
      prefetch: sinon.stub().returns(Promise.resolve()),
      sendToQueue: sinon.stub().returns(Promise.resolve()),
      publish: sinon.stub().returns(Promise.resolve()),
      ack: sinon.stub().returns(Promise.resolve()),
      consume: (queue, handler) => {
        this.queueHandlers[queue] = handler;
      }
    };

    this.stubChannel.assertQueue.withArgs('', { exclusive: true }).returns({ queue: 'exclusiveQueue' });

    // // goodly uses this when it calls createChannel on the broker
    this.stubBroker.createChannel.returns(Promise.resolve(this.stubChannel));

    // So...
    // since we're using async/await everywhere.. we need to extend
    // the promise so that we can simply chain the harness methods
    // this should probably be attached to a new library that
    let me = this;
    Promise.prototype.emit = function() {
      let args = arguments;
      return this.then(() => me.emit.apply(me, args));
    };
    Promise.prototype.expect = function() {
      let args = arguments;
      return this.then(() => me.expect.apply(me, args));
    };
    Promise.prototype.end = function() {
      let args = arguments;
      return this
        .then(() => me.end.apply(me, args));
    };
  }

  async emit(event, data) {
    debug('emit %s', event);
    await this.queueHandlers[this.service.name]({
      properties: {
        correlationId: 'fake-correlationId',
        headers: {
          contentType: 'raw'
        }
      },
      fields: {
        routingKey: event
      },
      content: data
    });
    return this;
  }

  async expect() {
    debug('expect');

    // convert arguments into array
    // todo move to utility
    let argTypes = Array.prototype.map.call(arguments, arguments, (arg) => Array.isArray(arg) ? 'array' : typeof(arg));

    if(argTypes.length === 2 && argTypes[0] === 'string' && argTypes[1] === 'object')
    return this;
  }

  async _expectEmit(event, data) {
    //this.stubChannel.consume.withArgs
  }

  async end(callback, done) {
    try {
      debug('ending');
      callback();
      if(done) done();
    }
    catch(err) {
      done(err);
    }
    finally {
      // undo stub
      Promise.prototype.emit = undefined;
      Promise.prototype.expect = undefined;
      Promise.prototype.end = undefined;
    }
  }
};

async function harness(service) {
  try {
    let instance = new Harness(service);
    debug('harness created');

    await instance.service.start({ brokerPath: 'harness', amqp: instance.stubAmqp });
    debug('service started');

    return instance;
  } catch(ex) {
    console.log(ex);
  }
};

module.exports = harness;