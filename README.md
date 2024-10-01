# fuzzdiff 
fuzzer for third party script developers :)

![Screen Recording 2024-10-01 at 13 59 09](https://github.com/user-attachments/assets/2b113870-3536-45f2-ac45-ec1caf83c4d1)

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
import { fuzzBehavior } from '@canalun/fuzzdiff'

const options = {
  dataNum: 10,
  scriptFilePath: path.resolve(__dirname, 'path/to/your/script'),
  outputPath: path.resolve(__dirname, 'path/to/output/dir'),
};

// check behavioral side-effects
fuzzBehavior(options)
```

Please try samples.
```bash
$ node ./sample/behavior.js
```

# requirements

You need `python3`! Sorry for inconvenience...!
