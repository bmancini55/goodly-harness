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

Then you use the harness to bootstrap a service.

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

Lets start with a simple service that contains two events; one that is only listening and one that is used for request/response.

```javascript
// construct the service
const goodly  = require('bar');
const service = goodly({ name: 'test' });

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
  let { foo } = data;

  // do something with the foo data
  let bars = await barDb.updateBars(foo);
  
  // emit the updates
  for(let bar of bars) {
    await emit('bar.updated', { bar });
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
  reply({ bar });
};
```

We will write a few tests to ensure that things are being called as expected inside our service using `sinon`.  We will also write tests to ensure the outputs from our tests are as expected.

```javascript
// TODO
```


##API

// TODO
