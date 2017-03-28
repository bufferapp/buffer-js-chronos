# Chronos
A small library to handle browser timining measures

## How To

The simplest way to measure something is to start the measure with `chronos.startMeasure('bar')` and then stop it `chronos.stopMeasure('bar')`.
To store the measure you should define a storing method when you instatiate Chronos passing it down in the configuration options

```
const ch = chronos({
  store: (data) => {
    …
  }
})
```

When that is provided Chronos will auto save the measures for you.
Chronos is using `requestIdleCallback` to parse and store measures, so autosave won't effect your app performances, anyway you are free to disable this behaviour setting `autoSave: false` in the options.
In this case you can manually save measures with `chronos.saveToStore()`.

You can measure anything against browser timing event with `chronos.measureFromSpecialEvent({ name: 'foo', eventName: 'navigationStart' })`, there is also a convenient method to measure against Navigation Start `chronos.measureFromNavigationStart('foo')`.

If you want to store any extra data along with your measures you can pass a `data` object in measure start options `chronos.startMeasure({name: 'foo', data: {tags: ['foo', 'bar']}})`, the data field will be passed down to your store method.

Happy measuring!
