# fuzzdiff 
fuzzer for third party script developers :)

# usage

```js
import { fuzz } from '@canalun/fuzzdiff'

fuzz('path/to/your/script')
```

Please try samples.
```bash
$ node ./sample/fuzztest.mjs
```

# design
- perf test and behavior test are different APIs, because the perf test needs trials much more than the behavior one.