import { connectableObservableDescriptor } from 'rxjs/internal/observable/ConnectableObservable';
import utilInstance from './util';

/**
 * Definition of threading class.
 * @class
 */
export class Threading {
    threading: Array<Array<boolean>>;
    wefts: Number;
    warps: Number;
    flipped_pattern: Array<Array<boolean>>;
    usedFrames: Array<number>;
    userInputCoordinates: Array<Array<number>>;

    /*Input: the number of warps and wefts in this draft
    Result: A flipped pattern (flipped in comparison to the pattern used in draft.ts) that is constructed with all false values,
            A threading 2D array that is constructed with all false values*/
    constructor(wefts: number, warps: number) {
        this.flipped_pattern = [];
        this.wefts = wefts;
        this.warps = warps;

        for(var i = 0; i < this.warps; i++) {
          this.flipped_pattern.push([]);
          for (var j = 0; j < this.wefts; j++) {
            this.flipped_pattern[i].push(false);
          }
        }

        this.threading = [];
        for (var i = 0; i < this.wefts; i++) {
            this.threading.push([]);
            for(var j = 0; j < this.warps; j++) {
              this.threading[i].push(false);
            }
        }

        this.usedFrames = [];
        this.userInputCoordinates = [];
    }

    /* Input: None
    Result: A threading updated to the current draw-down of the draft
    Algorithm modified from Laura Devendorf: https://unstable.design/prototyping-smart-textiles/_book/process/weaving/on-a-frame-loom.html
    */
    updateThreading() {
        //clears the threading to all false before processing (to account for the updating of threading while the draw-down is changing)
        this.threading = this.threading.map(x => x.map(y => false));

        //defining helper variables:
        var marked_strings = [];
        var marked_strings_frames_tracker = [];
        var column_tracker = [];

        for(var i = 0; i < this.userInputCoordinates.length; i++) {
          var frame = this.userInputCoordinates[i][0];
          var warp_thread = this.userInputCoordinates[i][1];
          var userMiscalc = false;
          for (var j = 0; j < marked_strings.length; j++) {
            if (marked_strings_frames_tracker[j] == frame && !utilInstance.equals(this.flipped_pattern[warp_thread], marked_strings[j])) {
              userMiscalc = true;
              this.deleteUserInput(this.userInputCoordinates[i][0], this.userInputCoordinates[i][1]);
            }
          }
          if (!userMiscalc) {
            this.threading[frame][warp_thread] = true;
            marked_strings.push(this.flipped_pattern[warp_thread]);
            marked_strings_frames_tracker.push(frame);
            column_tracker.push(warp_thread);
          }
        }
        for (var c = 0; c < this.flipped_pattern.length; c++) {
          var contains = false;
          for (var i = 0; i < marked_strings.length;i++) {
            if (utilInstance.equals(marked_strings[i], this.flipped_pattern[c])) {
              contains = true;
            }
          }

          //if this is a new pattern with at least 1 true value
          if (!contains && (utilInstance.countOnes(this.flipped_pattern[c]) > 0)){
            var processed= false;
            var indx = 0;
            var frame = utilInstance.findSmallestGap(marked_strings_frames_tracker);
            this.threading[frame][c] = true;

            //checks if this column has already been added and if so processed is set to true and the index in marked strings is set
            for (var j = 0; j < column_tracker.length; j++ ) {
              if (column_tracker[j] == c/* column_tracker.includes(c)*/) {
                processed =true;
                indx = j;
              }
            }
            //if already processed, then the marked_strings at the desired indx is set to this current column's pattern    
            if (processed) {
              marked_strings[indx] = this.flipped_pattern[c];
              column_tracker[indx] = c;
              marked_strings_frames_tracker[indx] = frame;
            } else { //else the new pattern is pushed
              marked_strings.push(this.flipped_pattern[c]);
              column_tracker.push(c);
              //the new frame for this "unprecedented" pattern is pushed
              marked_strings_frames_tracker.push(frame);
            }
          } else if (contains && utilInstance.countOnes(this.flipped_pattern[c]) > 0) { //otherwise if it is an old pattern with at least 1 true value
            //find the pattern in marked_strings and set threading at the corresponding frame of that original pattern and the new column to true
            for (var k = 0; k < marked_strings.length; k++) {
              if (utilInstance.equals(marked_strings[k], this.flipped_pattern[c])) {
                this.threading[marked_strings_frames_tracker[k]][c] = true;
              }
            }
          }
        }
        this.updateUsedFrames();
    }

    /* Input: the row and column of the adjusted draw-down point and the new bool value for this point
    Result: adjusts this.flipped_pattern at point to new bool value
    */
    updateFlippedPattern(row:number, j:number, bool:boolean) {
        this.flipped_pattern[j][row] = bool;
    }

    updateFlippedPatternFromArray(pattern: Array<Array<boolean>>) {
      this.flipped_pattern = [];

      for(var i = 0; i < this.warps; i++) {
        this.flipped_pattern.push([]);
        for (var j = 0; j < this.wefts; j++) {
          this.flipped_pattern[i].push(pattern[j][i]);
        }
      }
    }
    
    /* Input: None
    Result: Updates the used frames array to include only the index of the frames that has a true value in it
     */
    updateUsedFrames() {
        this.usedFrames =[];
        for (var i =0; i < this.threading.length; i++) {
            if (this.threading[i].includes(true)) {
                this.usedFrames.push(i);
            }
        }
    }

    // /*
    // Input: i for row of threading, j for column of threading
    // Result: returns wheter the threading grid is true at locationg (i,j)*/
    isUp(i:number, j: number) : boolean {
      if (i > -1 && i < this.warps && j > -1 && j < this.wefts) {
        return this.threading[i][j];
      }
      return false;
    }

    addUserInput(i:number, j:number) {
      var tempList = [i,j];
      var contains = false;
      for (var k = 0; k < this.userInputCoordinates.length;k++) {
        if (utilInstance.equals(tempList, this.userInputCoordinates[k])) {
          contains = true;
        }
      }
      if (!contains) {
        this.userInputCoordinates.push([]);
        this.userInputCoordinates[this.userInputCoordinates.length -1].push(i);
        this.userInputCoordinates[this.userInputCoordinates.length -1].push(j);
      }
    }

    deleteUserInput(i:number, j:number) {
      var tempList = [i,j];
      var contains = false;
      var newUserInput = [];
      for (var i = 0; i < this.userInputCoordinates.length; i++) {
        if (utilInstance.equals(tempList, this.userInputCoordinates[i])) {
          contains = true;
        } else {
          newUserInput.push(this.userInputCoordinates[i]);
        }
      }
      if(contains) {
        this.userInputCoordinates = newUserInput;
      }
    }
}