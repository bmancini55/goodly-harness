# goodly-harness
This is an integration testing harness for Goodly services. The harness can be used for testing your service to ensure that it mocked events are properly handled by your service and that the outputs from your service match the expected outputs.

##Getting Started

Start by including the module in your project:

```bash
npm install goodly-harness
```

Include the harness in your spec files:

```javascript
import harness from 'goodly-harness';
```

Then you use the harness to bootstrap a service. You can fake emitting an event and then assert that your service handled that event in an appropriate manner.

```javascript
describe('on foo.updated', () => {
  it('should emit bar.updated event', (done) => {
    harness(service)
      .emit('foo.updated', { id: 'foo-1' })
      .expect('bar.updated', { id: 'bar-1' })
      .end(done);
  })
});
```

Using the harness will automatically start your service and stub all interactions with the RabbitMQ. Using the harness treats input data into your service as if it was coming from RabbitMQ and other Goodly services.

##Example

Lets start with a simple service, the `bar` service. It listens for two events; one that is only listening and one that is used for request/response.

```javascript
// construct the service
const goodly  = require('goodly');
const service = goodly({ name: 'bar' });

// construct the bindings
service.on('foo.updated', fooUpdated);
service.on('request.bar', requestBar);

// export the module
module.exports = service;

/**
 * Example of a standard event collaboration
 * method where data comes in that the service uses.
 * The service will update its state from this event. 
 * The service will emit its updated state.
 */
async function fooUpdated({ data, emit }){
  // in this case, data is an instance of an updated foo object
  let foo = data;

  // do something with the foo data
  let bars = await barDb.updateBars(foo);
  
  // emit the updates
  for(let bar of bars) {
    await emit('bar.updated', bar);
  }
}

/**
 * Example of a request/response method. 
 * The service uses the request data to reply
 * with state the service owns
 */
async function requestBar({ reply, data }) {
  let { barId } = data;
  
  // load data from the request
  let bar = await barDb.findBar({ barId });
  
  // reply with state
  reply(bar);
};
```

We will write a few tests to ensure that things are being called as expected inside our service using `sinon`.  We will also write tests to ensure the outputs from our tests are as expected.  The example below uses `mocha`, `chai`, and `sinon` though these tools are not required.

```javascript
import harness from 'goodly-harness';
import service from './service';

// improt chai for assertions
import { expect } from 'chai';

// import sinon and a 'db' resource that will be stubbed
import sinon from 'sinon';
import barDb from './bar-db';

describe('bar service', () => {

  // stub the database resource before each test
  beforeEach(() => {
    sinon.stub(barDb);
  });
  
  // restore the database resource
  afterEach(() => {
    sinon.restore(barDb);
  });

  // test the foo.updated event that receieves a foo object 
  // and performs an update operation and emits the updated bar objects
  describe('on foo.updated', () => {

    // this test will validate the the db resource is called with the data supplied
    // in the event. it uses the end method to perform these assertions and terminate the 
    // test when the assertions are complete or the test has failed
    it('should update related bars', (done) => {
      harness(service)
        .emit('foo.updated', { id: 'foo-1', name: 'foo 1' })
        .end(() => expect(barDb.updateBars.callWithArgs({ id: 'foo-1', name: 'foo 1' }).to.be.true, done);
    });
    
    // this test will validate the service emits the expected events given the input.
    // it also calls done via the end method when the test has completed or failed.
    it('should emit the updated foos', (done) => {
      // stub the data returned by the database that will be emitted
      barDb.updateBars.returns([ { id: 'bar-1' }, { id: 'bar-2' }]);
      
      // execute the event to our service
      harness(service)
        .emit('foo.updated', {})
        .expect('bar.updated', { id: 'bar-1' })
        .expect('bar.updated', { id: 'bar-2' })
        .end(done);
    });
    
  });
  
  // test the request.bar event that receieves a request for a bar object
  // and replies with with the object from the database
  describe('on request.bar', () => {
    
    // this test triggers a request and asserts that the expected response object
    // was received.  when the test has finished, end is used to propagate success or failure.
    it('should reply with the database item', (done) => {
      barDb.findBar.withArgs({ barId: 1 }).returns({ id: 'bar-1' })
      harness(service)
        .request('request.bar', { barId: 1 })
        .expect({ id: 'bar-1' })
        .end(done);
    });
    
  });
});
```


##API

// TODO
