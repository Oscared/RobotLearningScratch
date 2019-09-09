## Master branch
The master branch is made for configuring the program.

## Website branch
The website branch is outdated.

## Level # branch
These branches are updated for each level 1-4 of the task of moving a robot.

## Use
Best use is to make changes in the version of the master branch and then compile it by running `npm run build` in scratch-gui folder. 
After building, the website can be run from the build subfolder in the scratch-gui folder using the index file.

## Test run
The website can be test run by first running `npm run prepublish` in the scratch-blocks folder to compile the custom blocks. Run `npm start` from the scratch-gui folder to host the website locally to test.

Follow these instructions here to install from the beginning if anything is wrong: [Scratch modification guide](https://scratch.mit.edu/discuss/topic/289503/?page=1)

## Extra: only add relevent variables
In '~/scratch-blocks/core/data_category.js' there is a function named 'Blockly.DataCategory' (row 43). This funciton creates the XML file that handles how the variables category is created in the GUI. To pick out relevant features to show, only return a list with the desired elements. The elements are stored in 'xmlList', you can look at an unaltered project and see which indexes you want to pick out. The first index, 'xmlList[0]', is the create new variables button and so on. Using 'console.log(xmlList)' the whole list can be printed and examined to see which elements to choose as well. So to only show the two first variables you comment out 'return xmlList' and replace it with 'return [xmlList[1], xmlList[2]]'. 
