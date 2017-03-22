// let's setup the browser env
import browserEnv from 'browser-env'
browserEnv()

import test from 'ava'

test.todo('start measure | should fail if high resolution timing is not supported')
test.todo('start measure | should use User Timing API if it\'s suported')
test.todo('start measure | should fallback if User Timing API isn\'t supported')
test.todo('stop measure')
test.todo('stop measure | on autosave it should try to store the measures')
test.todo('measure from special event')
test.todo('save | should throw an error if it\s missing a storing method')
