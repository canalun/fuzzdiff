# fuzzdiff 
fuzzer for third party script developers :)

# idea

'fuzzdiff' checks if your script has side effect on the page it's embedded on.
It works as follows:

1. generates random page(=DOM+JS).
2. runs the generated script on that page and records which API was called with what args and return values.
3. again, runs the generated script on that page, but this time, with your script embedded. And records the same as step 2.
4. compares the two records. If found some diff, it means your script has some side effects on web page.

This is the basic idea.

# usage

```js
import { fuzzBehavior, fussPerformance } from '@canalun/fuzzdiff'

// check behavioral side-effects
fuzzBehavior('path/to/your/script')

// check performance side-effects
fuzzPerformance('path/to/your/script')
```

Please try samples.
```bash
$ node ./sample/fuzztest.js
```
