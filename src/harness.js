
const { convertToBuffer, convertFromBuffer } = require('goodly/dist/util');
const sinon  = require('sinon');
const chai   = require('chai');
const debug  = require('debug')('goodly-harness');
const expect = chai.expect;

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
    Promise.prototype.request = function() {
      let args = arguments;
      return this.then(() => me.request.apply(me, args));
    };
    Promise.prototype.expect = function() {
      let args = arguments;
      return this.then(() => me.expect.apply(me, args));
    };
    Promise.prototype.end = function() {
      let args = arguments;
      return this
        .then(() => me.end.apply(me, args))
        .catch((err) => args[args.length - 1](err));
    };
  }

  async emit(event, data) {
    debug('emit %s', event);
    await this.queueHandlers[this.service.name]({
      properties: {
        correlationId: 'fake-correlationId',
        headers: {
          contentType: 'buffer' // this simply returns the data as-is
        }
      },
      fields: {
        routingKey: event
      },
      content: data
    });
    return this;
  }

  async request(event, data) {
    debug('request %s', event);
    await this.queueHandlers[this.service.name]({
      properties: {
        correlationId: 'fake-correlationId',
        headers: {
          contentType: 'buffer' // this simply returns the data as-is
        },
        replyTo: 'replyToQueue'
      },
      fields: {
        routingKey: event
      },
      content: data
    });
  }

  async expect() {
    if(arguments.length === 2) {
      this._expectEmit(arguments[0], arguments[1]);
    }
    else if (arguments.length === 1) {
      this._expectReply(arguments[0]);
    }
  }

  _expectEmit(event, data) {
    debug('expect emit of %s', event);

    let args = this.stubChannel.publish.args.splice(0, 1)[0];

    if(!args)
      throw new Error('Event ' + event + ' was not emitted');

    let { contentType } = convertToBuffer(data);

    let emittedEvent = args[1];
    let emittedData = convertFromBuffer(contentType, args[2]);

    expect(emittedEvent).to.equal(event);
    expect(emittedData).to.deep.equal(data);
  }

  _expectReply(data) {
    debug('expect reply');

    // call looks like:
    //  channel.sendToQueue(sendToQueue, buffer, { correlationId, headers, noAck: true });
    let args = this.stubChannel.sendToQueue.args.splice(0, 1)[0];

    if (!args)
      throw new Error('Reply was not send');

    let { contentType } = convertToBuffer(data);

    let emittedData = convertFromBuffer(contentType, args[1]);
    expect(emittedData).to.deep.equal(data);
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
      Promise.prototype.request = undefined;
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