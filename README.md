## Master branch
The master branch is made for configuring the program.

## Website branch
The website branch is the compiled version of the master branch. This should be able to directly host the website directly and one should be able to make changes to the compiled version directly.

## Use
Best use is to make changes in the version of the master branch and then compile it by running `npm run build` in scratch-gui folder. 
After building, the website can be run from the build subfolder in the scratch-gui folder using the index file.

## Test run
The website can be test run by first running `npm run prepublish` in the scratch-blocks folder to compile the custom blocks. Run `npm start` from the scratch-gui folder to host the website locally to test.

Follow these instructions here to install from the beginning if anything is wrong: [Scratch modification guide](https://scratch.mit.edu/discuss/topic/289503/?page=1)

