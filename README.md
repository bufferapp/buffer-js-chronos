# Chronos
A small library to handle browser timining measures

## How To

Start a measure with `buffer.chronos.startMeasure('bar');` and can pass an optional target duration, that will be stored along side the measure
`buffer.chronos.startMeasure('bar', 200);`

Stop a running measure with `buffer.chronos.stopMeasure('bar')`.

To save the recorded measure to a store (ex. Buffer Metrics) just use `buffer.chronos.saveToStore()`, but remember to setup the store with 
`buffer.chronos.setStoreMethod((data) => {…})`
