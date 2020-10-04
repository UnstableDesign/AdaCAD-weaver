import { Directive, ElementRef, ViewChild, HostListener, Input, Renderer2 } from '@angular/core';

import { Observable, Subscription, fromEvent, from } from 'rxjs';
import * as d3 from "d3";
import {cloneDeep, now} from 'lodash';

import { Draft } from '../model/draft';
import { Shuttle } from '../model/shuttle';
import { Pattern } from '../model/pattern';
import { Point } from '../model/point';
import { Selection } from '../model/selection';
import { CanvasToBMP } from '../model/canvas2image';
import { DraftSegment } from '../../ngrx/draft/segment';
import { AddAction } from '../../ngrx/draft/actions';
import {select, Store} from '@ngrx/store';
import {getCurrentDraft, selectAll} from '../../ngrx/draft/selectors';
import {Subject} from 'rxjs';
import {takeLast, takeUntil} from 'rxjs/operators';
import {AppState} from '../../ngrx/app.state';

const generateId = () => (Date.now().toString(36) + Math.random().toString(36).substr(2, 5)).toUpperCase();

/**
 * WeaveDirective handles the events and manipulation of the weave draft.
 * @class
 */
@Directive({
  selector: '[weave]'
})
export class WeaveDirective {
  /// ATTRIBUTES
  /**
   * Contains the name of the brush being used to manipulate the weave draft.
   * It is defined and inputed from the HTML declaration of the WeaveDirective.
   * @property {string}
   */
  @Input('brush') brush: any;

  /**
   * The Draft object containing the pattern and shuttle information.
   * It is defined and inputed from the HTML declaration of the WeaveDirective.
   * @property {Draft}
   */
  @Input('draft') weave: any;



  /**
   * The HTML canvas element within the weave draft.
   * @property {HTMLCanvasElement}
   */
  canvasEl: HTMLCanvasElement;

  /**
   * The pattern that has been copied from the draft pattern.
   * @property {Array<Array<boolean>>}
   */
  copy: Array<Array<boolean>>;

  /**
   * The 2D context of the canvas
   * @property {any}
   */
  cx: any;

  /**
   * The 2D context of the threading canvas
   * @property {any}
   */
  cxThreading: any;

  /**
   * The 2D context of the treadling canvas
   * @property {any}
   */
  cxTreadling: any;

  /**
   * The 2D context of the treadling canvas
   * @property {any}
   */
  cxTieups: any;

  /**
   * The current selection within the weave canvas.
   * @property {Selection}
   */
  selection: Selection = new Selection();

  /**
   * Subscribes to move event after a touch event is started.
   * @property {Subscription}
   */
  subscription: Subscription;

  /**
   * The HTML SVG element used to show the selection.
   * @property {HTMLElement}
   */
  svgEl: HTMLElement;

  /**
   * The HTML canvas element within the weave draft for threading.
   * @property {HTMLCanvasElement}
   * 
   */
  threadingCanvas: HTMLCanvasElement;

    /**
   * The HTML canvas element within the weave draft for treadling.
   * @property {HTMLCanvasElement}
   * 
   */
  treadlingCanvas: HTMLCanvasElement;

  /**
   * The HTML canvas element within the weave draft for tieups.
   * @property {HTMLCanvasElement}
   * 
   */
  tieupsCanvas: HTMLCanvasElement;

  private segments$: Observable<DraftSegment[]>;
  private prevSegment = null;
  private currSegment = null;

  private tempPattern: Array<Array<boolean>>;
  private segment: DraftSegment;
  private unsubscribe$ = new Subject();

  private threadingNow: Array<Array<number>>;
  private threadingLast: Array<Array<number>>;
  private treadlingNow: Array<Array<number>>;
  private treadlingLast: Array<Array<number>>;
  private tieupsLast: Array<Array<number>>;
  private tieupsNow: Array<Array<number>>;

  private threadingSize: number;
  private treadles: number;

  private shuttleLocation: number;

  /// ANGULAR FUNCTIONS
  /**
   * Creates the element reference.
   * @constructor
   */
  constructor(private el: ElementRef, private store: Store<any>) {
    this.threadingNow = [];
    this.threadingLast = [];
    this.threadingSize = 160;
    this.shuttleLocation = 166;
    this.treadles = 10;
    this.treadlingNow = [];
    this.treadlingLast = [];
    this.tieupsLast = [];
    this.tieupsNow = [];
  }

  /**
   *
   */
  ngOnInit() {
    this.segments$ = this.store.pipe(select(selectAll));
    // define the elements and context of the weave draft, threading, treadling, and tieups.
    this.canvasEl = this.el.nativeElement.children[1];
    this.svgEl = this.el.nativeElement.lastElementChild;
    this.threadingCanvas = this.el.nativeElement.firstElementChild.firstElementChild;
    this.tieupsCanvas = this.el.nativeElement.children[2].firstElementChild;
    this.treadlingCanvas = this.el.nativeElement.children[5].firstElementChild;
    this.cx = this.canvasEl.getContext('2d');
    this.cxThreading = this.threadingCanvas.getContext('2d');
    this.cxTreadling = this.treadlingCanvas.getContext('2d');
    this.cxTieups = this.tieupsCanvas.getContext('2d');

    // set the width and height
    this.canvasEl.width = this.weave.warps * 20;
    this.canvasEl.height = this.weave.wefts * 20;
    this.threadingCanvas.width = this.weave.warps *20;
    this.threadingCanvas.height = this.threadingSize;
    this.treadlingCanvas.height = this.weave.wefts * 20;
    this.treadlingCanvas.width = this.treadles * 20;
    this.tieupsCanvas.width = this.treadles*20;
    this.tieupsCanvas.height = this.threadingSize;

    // Set up the initial grid.
    this.redraw(this.cx, this.canvasEl,"pattern");
    this.redraw(this.cxThreading, this.threadingCanvas, "threading");
    this.redraw(this.cxTreadling, this.treadlingCanvas, "treadling");
    this.redraw(this.cxTieups, this.tieupsCanvas, "tieups");

    // make the selection SVG invisible using d3
    d3.select(this.svgEl).style('display', 'none');

    this.store.pipe(select(getCurrentDraft), takeUntil(this.unsubscribe$)).subscribe(undoredo => {
      this.prevSegment = this.currSegment;
      this.currSegment = undoredo;
    });
  }

  /**
   * 
   */
   ngOnDestroy() {
     this.removeSubscription();
   }

   /// EVENTS
  /**
   * Touch start event. Subscribes to the move event.
   * @extends WeaveDirective
   * @param {Event} event - The mousedown event.
   * @returns {void}
   */
  @HostListener('mousedown', ['$event'])
  private onStart(event) {

    var offset = 0;

    // create offset if brush is select to allow easier selection.
    if (this.brush === 'select') {
      offset = 7;
    }

    // We only care when the event happens in the canvas.
    if (event.target.localName === 'canvas') {
      // avoid mem leaks 
      this.removeSubscription();    
      // set up subscription for move event
      this.subscription = 
        fromEvent(event.target, 'mousemove').subscribe(e => this.onMove(e));   
    
      // set up the Point to be used.
      const currentPos: Point = {
        x: Math.floor((event.offsetX + offset) / 20) * 20,
        y: Math.floor((event.offsetY + offset) / 20) * 20,
        i: Math.floor((event.offsetY + offset) / 20),
        j: Math.floor((event.offsetX + offset) / 20),
      };

      // Save temp pattern
      this.tempPattern = cloneDeep(this.weave.pattern);

      // determine action based on brush type.
      switch (this.brush) {
        case 'invert':
        case 'point':
        case 'erase':
          if (event.target && event.target.closest('.treadling-container')) {
            this.drawOnTreadling(currentPos);
          } else if (event.target && event.target.closest('.tieups-container')) {
            this.drawOnTieups(currentPos);
          } else if (event.target && event.target.closest('.threading-container')) {
            this.drawOnThreading(currentPos);
          } else {
            this.drawOnDrawdown(currentPos);
          }
          break;
        case 'select':
          this.selection.start = currentPos;
          this.selection.end = currentPos;
          this.selection.width = 0;
          this.selection.height = 0;
          d3.select(this.svgEl).style('display', 'none');
          break;
        default:
          break;
      }
      this.segment = {
        start: [currentPos.i, currentPos.j],
        end: [currentPos.i, currentPos.j],
        pattern: null,
        id: generateId(),
      }
    }
  }

  /**
   * Event called when mouse down and moved within the canvas.
   * @extends WeaveDirective
   * @param {Event} event - The mousemove event.
   * @returns {void}
   */
  private onMove(event) {
    var offset = 0;

    // create offset if brush is select to allow easier selection.
    if (this.brush === 'select') {
      offset = 7;
    }

    // set up the point based on touched square.
    const currentPos: Point = {
      x: Math.floor((event.offsetX + offset) / 20) * 20,
      y: Math.floor((event.offsetY + offset) / 20) * 20,
      i: Math.floor((event.offsetY + offset) / 20),
      j: Math.floor((event.offsetX + offset) / 20),
    };

    // determine action based on brush type. invert inactive on move.
    switch (this.brush) {
      case 'point':
      case 'erase':
        if (event.target && event.target.closest('.treadling-container')) {
          this.drawOnTreadling(currentPos);
        } else if (event.target && event.target.closest('.tieups-container')) {
          this.drawOnTieups(currentPos);
        } else if (event.target && event.target.closest('.threading-container')) {
          this.drawOnThreading(currentPos);
        } else {
          this.drawOnDrawdown(currentPos);
        }
        break;
      case 'select':
        this.selection.end = currentPos;
        this.selection.setParameters();
        this.selectArea();
        break;
      case 'invert':
      default:
        break;
    }

    var i = currentPos.i, j = currentPos.j;
    if (this.segment.start[0] > i) this.segment.start[0] = i;
    if (this.segment.start[1] > j) this.segment.start[1] = j;
    if (this.segment.end[0] < i) this.segment.end[0] = i;
    if (this.segment.end[1] < j) this.segment.end[1] = j;
  }

  /**
   * Event removes subscription when touch has ended.
   * @extends WeaveDirective
   * @param {Event} event - The mouseleave or mouseup event.
   * @returns {void}
   */
  @HostListener('mouseleave', ['$event'])
  @HostListener('mouseup', ['$event'])
  private onEnd(event) {
    // remove subscription unless it is leave event with select.
    if (!(event.type === 'mouseleave' && this.brush === 'select')) {
      this.removeSubscription();

      if (event.type === 'mouseup' && this.brush != 'select') {
        let segmentPattern = [];

        for (var i = this.segment.start[0]; i < this.segment.end[0] + 1; i++) {
          segmentPattern.push([])
          var index = i - this.segment.start[0];
          for (var j = this.segment.start[1]; j < this.segment.end[1] + 1; j++) {
            var past, present;
            past = this.tempPattern[i][j];
            present = this.weave.pattern[i][j];
            segmentPattern[index].push(past ? !present : present)
          }
        }
        this.segment.pattern = segmentPattern;
        this.onAdd(this.segment);
      }
    }
  }

  /**
   * Remove the subscription from the move event.
   * @extends WeaveDirective
   * @returns {void}
   */
 private removeSubscription() {    
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  /// PRIVATE FUNCTIONS
  /**
   * Creates the copied pattern.
   * @extends WeaveDirective
   * @returns {void}
   */
  private copyArea() {
    const si = Math.min(this.selection.start.i, this.selection.end.i);
    const sj = Math.min(this.selection.start.j, this.selection.end.j);
    var w = this.selection.width / 20;
    var h = this.selection.height / 20;

    var copy = [];

    // Create the pattern based on weave draft.
    for (var i = 0; i < h; i++) {
      copy.push([]);
      for(var j = 0; j < w; j++) {
        copy[i].push(this.weave.isUp(si + i, sj + j));
      }
    }

    this.copy = copy;

  }

  /**
   * Draws the grid lines onto the canvas.
   * @extends WeaveDirective
   * @returns {void}
   */
  private drawGrid(cx,canvas) {
    var i,j;
    cx.fillStyle = "white";
    cx.fillRect(0,0,canvas.width,canvas.height);
    cx.lineWidth = 2;
    cx.lineCap = 'round';
    cx.strokeStyle = '#000';
    cx.setLineDash([1,5]);

    cx.beginPath();

    // draw vertical lines
    for (i = 0; i <= canvas.width; i += 20) {
      cx.moveTo(i, 0);
      cx.lineTo(i, canvas.height);
    }

    // draw horizontal lines
    for (i = 0; i <= canvas.height; i += 20) {
      cx.moveTo(0, i);
      cx.lineTo(canvas.width, i);
    }

    cx.stroke();

    // reset the line dash.
    cx.setLineDash([0]);
  }

  /**
   * Draws or erases a single rectangle on the canvas. Updates the weave draft.
   * @extends WeaveDirective
   * @param {Point} currentPos - the current position of the mouse within draft.
   * @returns {void}
   */
  private drawOnDrawdown( currentPos: Point ) {
    // incase the context is not set
    var color = this.weave.getColor(currentPos.i);

    // start our drawing path
    if (color) {
      this.cx.fillStyle = color;
    } else {
      this.cx.fillStyle = '#000000';
    }

    if (!this.cx || !currentPos) { return; }

    // Set the heddles based on the brush.
    switch (this.brush) {
      case 'point':
        this.weave.setHeddle(currentPos.i,currentPos.j,true);
        break;
      case 'erase':
        this.weave.setHeddle(currentPos.i,currentPos.j,false);
        break;
      case 'invert':
        const val = !this.weave.isUp(currentPos.i,currentPos.j);
        this.weave.setHeddle(currentPos.i,currentPos.j,val);
        break;
      default:
        break;
    }

    // draws the rectangle if heddle is up, otherwise it is erased.
    if (this.weave.isUp(currentPos.i, currentPos.j)) {
      this.cx.strokeRect(currentPos.x + 2, currentPos.y + 2, 16, 16);
      this.cx.fillRect(currentPos.x + 2, currentPos.y + 2, 16, 16);
    } else {
      this.cx.clearRect(currentPos.x + 1, currentPos.y + 1, 18, 18);
    }
    if (this.weave.threading.usedFrames.length > this.threadingSize/20) {
      this.updateSizeThreading();
    }

    if (this.weave.treadling.treadle_count > this.treadles) {
      this.updateSizeTreadling();
    }

    this.redrawThreading();
    this.redrawTreadling();
    this.redrawTieups();
  }

  /**
   * Draws or erases a single rectangle on the canvas. Updates the tieups.
   * @extends WeaveDirective
   * @param {Point} currentPos - the current position of the mouse within draft.
   * @returns {void}
   */
  private drawOnTieups( currentPos: Point ) {
    // incase the context is not set
    var color = this.weave.getColor(currentPos.i);

    // start our drawing path
    if (color) {
      this.cxTieups.fillStyle = color;
    } else {
      this.cxTieups.fillStyle = '#000000';
      this.cxTieups.fillStyle = '#000000';
    }
    if (!this.cxTieups || !currentPos) { return; }
    if (currentPos.i > -1 && (currentPos.j < this.weave.tieups.treadle_count || currentPos.j <  8 ) && currentPos.i > -1 && (currentPos.i < this.weave.tieups.usedFrames || currentPos.i < 10)) {
      switch (this.brush) {
        case 'point':
          this.weave.tieups.tieups[currentPos.j][((this.threadingSize / 20)-1) -currentPos.i] = true;
          this.weave.tieups.addUserInput(currentPos.j, this.threadingSize/20-1-currentPos.i);
          break;
        case 'erase':
          this.weave.tieups.tieups[currentPos.j][((this.threadingSize / 20)-1)-currentPos.i] = false;
          this.weave.tieups.deleteUserInput(currentPos.j, this.threadingSize/20-1-currentPos.i);
          break;
        case 'invert':
          const val = !this.weave.tieups.isUp(currentPos.j,((this.threadingSize / 20)-1)-currentPos.i);
          this.weave.tieups.tieups[currentPos.j][((this.threadingSize / 20)-1)-currentPos.i] = val;
          if (!val) {
            this.weave.tieups.addUserInput(currentPos.j, this.threadingSize/20-1-currentPos.i);
          } else {
            this.weave.tieups.deleteUserInput(currentPos.j, this.threadingSize/20-1-currentPos.i);

          }
          break;
        default:
          break;
      }
    }
    // draws the rectangle if heddle is up, otherwise it is erased.
    // if (this.weave.tieups.isUp(((this.threadingSize / 20)-1) -currentPos.i, currentPos.j)) {
    //   this.cxTieups.strokeRect(currentPos.x + 2, currentPos.y + 2, 16, 16);
    //   this.cxTieups.fillRect(currentPos.x + 2, currentPos.y + 2, 16, 16);
    // } else {
    //   this.cxTieups.clearRect(currentPos.x + 1, currentPos.y + 1, 18, 18);
    // }
    this.redrawTieups();

    var updatesToDrawdown = this.weave.updateDrawDown();
    this.weave.tieups.updatePattern(this.weave.pattern);

    for (var i = 0; i < updatesToDrawdown.length; i++) {
      // draws the rectangle if heddle is up, otherwise it is erased.
      var x = updatesToDrawdown[i][0];
      var y = updatesToDrawdown[i][1];
      if (this.weave.isUp(x, y)) {
        this.cx.strokeRect((y*20)+2, (x*20)+2, 16, 16);
        this.cx.fillRect((y*20)+2, (x*20)+2 , 16, 16);
        this.weave.threading.updateFlippedPattern(x, y,true);
      } else {
        this.cx.clearRect((y*20) + 1, (x*20) + 1, 18, 18);
        this.weave.threading.updateFlippedPattern(x, y,false);
      }
    }
    this.redrawDrawdown();
  }

  /**
   * Draws or erases a single rectangle on the canvas. Updates the threading.
   * @extends WeaveDirective
   * @param {Point} currentPos - the current position of the mouse within draft.
   * @returns {void}
   */
  private drawOnThreading( currentPos: Point ) {
    // incase the context is not set
    var color = this.weave.getColor(currentPos.i);

    // start our drawing path
    if (color) {
      this.cxThreading.fillStyle = color;
    } else {
      this.cxThreading.fillStyle = '#000000';
      this.cxThreading.fillStyle = '#000000';
    }
    if (!this.cxThreading || !currentPos) { return; }

    if (currentPos.i > -1 && currentPos.i < this.weave.warps && currentPos.j > -1 && currentPos.j < this.weave.wefts) {
      switch (this.brush) {
        case 'point':
          //TODO: computations
          for (var i = 0; i < this.weave.threading.threading.length; i++) {
            if(this.weave.threading.threading[i][currentPos.j]) {
              this.weave.threading.threading[i][currentPos.j] = false;
              this.weave.threading.deleteUserInput(i, currentPos.j);
            }
          }
          this.weave.threading.threading[((this.threadingSize/20)-1)-currentPos.i][currentPos.j] = true;
          this.weave.threading.addUserInput(((this.threadingSize/20)-1)-currentPos.i,currentPos.j);
          break;
        case 'erase':
          //TODO: computations
          this.weave.threading.threading[((this.threadingSize/20)-1)-currentPos.i][currentPos.j] = false;
          this.weave.threading.deleteUserInput(((this.threadingSize/20)-1)-currentPos.i, currentPos.j);
          break;
        case 'invert':
          const val = !this.weave.threading.isUp((this.threadingSize/20)-currentPos.i,(currentPos.j));
          this.weave.threading.threading[((this.threadingSize/20)-1)-currentPos.i][currentPos.j] = val;
          if (val) {
            this.weave.threading.addUserInput(((this.threadingSize/20)-1)-currentPos.i, currentPos.j);
          } else {
            this.weave.threading.deleteUserInput(((this.threadingSize/20)-1)-currentPos.i,currentPos.j);
          }
          break;
        default:
          break;
      }
    }

    var updatesToDrawdown = this.weave.updateDrawDown();
    this.weave.tieups.updatePattern(this.weave.pattern);
    this.weave.tieups.updateTieUps();
    this.weave.treadling.updateTreadling();
    this.redrawThreading();
    this.redrawTreadling();
    this.redrawTieups();

    for (var i = 0; i < updatesToDrawdown.length; i++) {
      // draws the rectangle if heddle is up, otherwise it is erased.
      var x = updatesToDrawdown[i][0];
      var y = updatesToDrawdown[i][1];
      if (this.weave.isUp(x, y)) {
        this.cx.strokeRect((20*y) + 2, (20*x) + 2, 16, 16);
        this.cx.fillRect((20*y) + 2, (20*x) + 2, 16, 16);
        this.weave.threading.updateFlippedPattern(x, y,true);
      } else {
        this.cx.clearRect((20*y) + 1, (20*x) + 1, 18, 18);
        this.weave.threading.updateFlippedPattern(x, y,false);
      }
    }
    this.redrawDrawdown();
  }


  /**
   * Draws or erases a single rectangle on the canvas. Updates the treadling.
   * @extends WeaveDirective
   * @param {Point} currentPos - the current position of the mouse within draft.
   * @returns {void}
   */
  private drawOnTreadling( currentPos: Point ) {
    // incase the context is not set
    var color = this.weave.getColor(currentPos.i);

    // start our drawing path
    if (color) {
      this.cxTreadling.fillStyle = color;
    } else {
      this.cxTreadling.fillStyle = '#000000';
      this.cxTreadling.fillStyle = '#000000';
    }
    if (!this.cxTreadling || !currentPos) { return; }

    
    if (currentPos.i > -1 && currentPos.i < this.weave.wefts && currentPos.j > -1 &&(currentPos.j < 10 || currentPos.j < this.weave.treadling.treadle_count)) {
      switch (this.brush) {
        case 'point':
          this.weave.treadling.treadling[currentPos.i][currentPos.j] = true;
          this.weave.treadling.addUserInput(currentPos.i, currentPos.j);
          break;
        case 'erase':
          this.weave.treadling.treadling[currentPos.i][currentPos.j] = false;
          this.weave.treadling.deleteUserInput(currentPos.i, currentPos.j);
          break;
        case 'invert':
          const val = !this.weave.treadling.isUp(currentPos.i,currentPos.j);
          this.weave.treadling.treadling[currentPos.i][currentPos.j] = val;
          if (!val) {
            this.weave.treadling.addUserInput(currentPos.i, currentPos.j);
          } else {
            this.weave.treadling.deleteUserInput(currentPos.i, currentPos.j);
          }
          break;
        default:
          break;
      }
    }
    
    this.redrawTreadling();

    var updatesToDrawdown = this.weave.updateDrawDown();
    this.weave.tieups.updatePattern(this.weave.pattern);

    for (var i = 0; i < updatesToDrawdown.length; i++) {
      // draws the rectangle if heddle is up, otherwise it is erased.
      var x = updatesToDrawdown[i][0];
      var y = updatesToDrawdown[i][1];
      if (this.weave.isUp(x, y)) {
        this.cx.strokeRect((y*20) + 2, (x*20)+ 2, 16, 16);
        this.cx.fillRect((y*20) + 2, (x*20) + 2, 16, 16);
        this.weave.threading.updateFlippedPattern(x, y,true);
      } else {
        this.cx.clearRect((y*20) + 1, (x*20) + 1, 18, 18);
        this.weave.threading.updateFlippedPattern(x, y,false);
      }
    }
    this.redrawDrawdown();
  }

  /**
   * Fills in selected area of canvas. Updates the pattern within selection.
   * @extends WeaveDirective
   * @param {Selection} selection - defined user selected area to fill.
   * @param {Array<Array<boolean>>} - the pattern used to fill the area.
   * @param {string} - the type of logic used to fill selected area.
   * @returns {void}
   */
  private fillArea(
    selection: Selection, 
    pattern: Array<Array<boolean>>, 
    type: string
  ) {
    const si = Math.min(selection.start.y, selection.end.y);
    const sj = Math.min(selection.start.x, selection.end.x);
    var color = "#000000"

    this.weave.updateSelection(selection, pattern, type);

    let segmentPattern = [];
    for (var i = this.segment.start[0]; i < this.segment.end[0] + 1; i++) {
      segmentPattern.push([])
      var index = i - this.segment.start[0];
      for (var j = this.segment.start[1]; j < this.segment.end[1] + 1; j++) {
        var past, present;
        past = this.tempPattern[i][j];
        present = this.weave.pattern[i][j];
        segmentPattern[index].push(past ? !present : present)
      }
    }
    this.segment.pattern = segmentPattern;
    this.onAdd(this.segment);

    for (var i = si; i < si + selection.height; i+= 20) {
      color = this.weave.getColor(i / 20);
      this.cx.fillStyle = color;
      for (var j = sj; j < sj + selection.width; j += 20) {
        if (this.weave.isUp(i / 20, j / 20)) {
          this.cx.setLineDash([0]);
          this.cx.strokeRect(j + 2, i + 2, 16, 16);
          this.cx.fillRect(j + 2, i + 2, 16, 16);
        } else {
          this.cx.clearRect(j + 1, i + 1, 18, 18);
        }
      }
    }
    this.weave.threading.updateFlippedPatternFromArray(this.weave.pattern);
    this.weave.tieups.updatePattern(this.weave.pattern);
    this.weave.threading.updateThreading();
    this.weave.tieups.updateThreading(this.weave.threading.threading);
    this.weave.treadling.updateTreadling();
    this.weave.tieups.updateTreadling(this.weave.treadling.treadling);
    this.weave.tieups.updateTieUps();
    this.redrawThreading();
    this.redrawTreadling();
    this.redrawTieups();
  }

  private undoRedoSegment() {

    console.log(this.prevSegment);
    
    var start = this.prevSegment.start;
    var end = this.prevSegment.end;
    var segment = this.prevSegment.pattern;

    var oldBrush = this.brush;

    this.brush = 'invert';
    console.log(oldBrush);

    for (var i = start[0]; i <= end[0]; i++) {
      for (var j = start[1]; j <= end[1]; j++ ) {
        if (segment[i-start[0]][j-start[1]]) {
          this.drawOnDrawdown({
            x: j * 20,
            y: i * 20,
            i: i,
            j: j
          });
        }
      }
    }

    this.brush = oldBrush;
  }

  /**
   * Redraws one row to avoid drawing the entire canvas.
   * @extends WeaveDirective
   * @returns {void}
   */
  private redrawRow(y, i,cx) {
    var color = '#000000'

    // Gets color of row.
    color = this.weave.getColor(i);
    cx.fillStyle = color;

    // draw row
    for (var j = 0; j < this.weave.warps * 20; j += 20) {
      if (this.weave.isUp(i, j / 20)) {
        cx.strokeRect(j + 2, y + 2, 16, 16);
        cx.fillRect(j + 2, y + 2, 16, 16);
      } else {
        cx.clearRect(j + 1, y + 1, 18, 18);
      }
    }
  }

  /**
   * Redraws the rectangles associated with the list this.LastThreading (called after an update to the threading grid's size)
   * @extends WeaveDirective
   * @returns {void}
   */
  private redrawLastThreading() {
    this.cx.fillStyle = '#000000';
    this.cxThreading.fillStyle = '#000000';

    for (var i =0; i < this.threadingNow.length; i++) {
      this.cxThreading.strokeRect((this.threadingLast[i][0]*20)+2, (this.threadingSize-(this.threadingLast[i][1]*20)-20)+2,16,16);
      this.cxThreading.fillRect((this.threadingLast[i][0]*20)+2, (this.threadingSize-(this.threadingLast[i][1]*20)-20)+2,16,16);
    }
  }
  /**
   * Creates the selection overlay
   * @extends WeaveDirective
   * @returns {void}
   */
  private selectArea() {
    var left, top, x, y, anchor;

    x = 5; 
    y = 20;
    anchor = 'start';

    if (this.selection.start.x < this.selection.end.x) {
        x = this.selection.width - 10;
        anchor = 'end';
     }

     if (this.selection.start.y < this.selection.end.y) {
       y = this.selection.height - 10;
     }

    // define the left and top offsets
    left = Math.min(this.selection.start.x, this.selection.end.x);
    top = Math.min(this.selection.start.y, this.selection.end.y);

    // updates the size of the selection
    d3.select(this.svgEl)
      .attr("width", this.selection.width)
      .attr("height",this.selection.height)
      .style('display', 'initial')
      .style('left', left + this.canvasEl.offsetLeft)
      .style('top', top + this.canvasEl.offsetTop);

    // updates the text within the selection
    d3.select(this.svgEl)
      .select('text')
      .attr('fill', '#424242')
      .attr('font-weight', 900)
      .attr('font-size', 18)
      .attr('stroke', 'white')
      .attr('stroke-width', 1)
      .attr('x', x)
      .attr('y', y)
      .attr('text-anchor', anchor)
      .text(this.selection.height / 20 +' x '+ this.selection.width / 20);

  }

  /// PUBLIC FUNCTIONS
  /**
   * Visualizes the path of the yarns within the weave.
   * @extends WeaveDirective
   * @returns {void}
   */
  public functional() {
    this.updateSize();
    this.cx.clearRect(0,0, this.canvasEl.width, this.canvasEl.height);
    // this.drawGrid();
    this.cx.setLineDash([0]);

    for (var l = 0; l < this.weave.shuttles.length; l++) {
      // Each shuttle.
      this.cx.strokeStyle = this.weave.shuttles[l].getColor();
      this.cx.lineWidth = 5;
      var first = true;
      var left = !this.weave.shuttles[l].insert;
      var py = null;
      var s,e;
      var s1 = null;
      var s2 = null;
      var e1 = null;
      var e2 = null;

      for (var i = this.weave.visibleRows.length; i > 0 ; i--) {
        var y = ((i - 1) * 20) + 10;
        var r = this.weave.visibleRows[i - 1];
        first = true;
        for (var x = 0; x < this.weave.pattern[r].length; x++) {

          if (this.weave.isUp(i - 1,x)) {

            if (first && this.weave.rowShuttleMapping[r] === l) {
              this.cx.beginPath();
              this.cx.moveTo(x * 20 + 5, y);
              this.cx.lineTo((x + 1)* 20 - 5, y)
              first = false;
              if (s1 === null) {
                s1 = (x * 20) + 5;
                e1 = (x + 1) * 20 - 5;
                py = y;
              } else {
                s2 = (x * 20) + 5;
                e2 = (x + 1) * 20 - 5;
              }
            } else if (this.weave.rowShuttleMapping[r] === l) {
              this.cx.lineTo((x + 1) * 20 - 5, y);

              if (py === y) {
                e1 = (x + 1) * 20 - 5;
              } else {
                e2 = (x + 1) * 20 - 5;
              }

            }
          }
        }
        if (first === false) {
          this.cx.stroke();
        }

        if (s2 !== null && e2 !== null) {
          e = Math.max(e1,e2);
          s = Math.min(s1,s2);
          this.cx.beginPath();
          if (left) {
            this.cx.moveTo(s1, py);
            this.cx.lineTo(s, py);
            this.cx.lineTo(s, y);
            this.cx.lineTo(s2, y);
          } else if (!left) {
            this.cx.moveTo(e1, py);
            this.cx.lineTo(e, py);
            this.cx.lineTo(e, y);
            this.cx.lineTo(e2, y);
          }
          this.cx.stroke();
          s1 = s2;
          e1 = e2;
          s2 = null;
          e2 = null;
          py = y;
          left = !left;
        }

      }
    }

    this.cx.strokeStyle = "#000";
  }

  public redrawTieups() {
    for (var i = 0; i < this.weave.tieups.tieups.length; i++) {
      for(var j = 0; j < this.weave.tieups.tieups[i].length; j ++) {
        if (this.weave.tieups.tieups[i][j]) {
          this.tieupsNow.push([i,j]);
        }
      }
    }

    for (var i = 0; i < this.tieupsLast.length; i++) {
      var fresh = false;
      for (var j = 0; j < this.tieupsNow.length; j++) {
        if (this.tieupsLast[i] == this.tieupsNow[j]) {
          fresh = true;
        }
      }
      if (!fresh) {
        this.cxTieups.clearRect((this.tieupsLast[i][0]*20)+1, (this.threadingSize-this.tieupsLast[i][1]*20)-20+1,18,18);
      }
    }

    this.tieupsLast = [];
    for (var i = 0; i < this.tieupsNow.length; i++) {
      this.cxTieups.strokeRect((this.tieupsNow[i][0]*20)+2, (this.threadingSize-this.tieupsNow[i][1]*20)-20+2,16,16);
      this.cxTieups.fillRect((this.tieupsNow[i][0]*20)+2, (this.threadingSize-this.tieupsNow[i][1]*20)-20+2,16,16);
      this.tieupsLast.push(this.tieupsNow[i]);
    }
    this.tieupsNow = [];
  }

  public redrawThreading() {
    for (var i = 0; i < this.weave.wefts; i++) {
      for (var j = 0; j < this.weave.threading.threading[i].length; j++) {
        if(this.weave.threading.threading[i][j]) {
          this.threadingNow.push([j,i]);
        }
      }
    }
    //examines if there are stale threading marks left on the threading grid by comparing the two lists: this.threadingLast and this.threadingNow
    for (var i = 0; i < this.threadingLast.length; i++) {
      var fresh = false;
      for(var j = 0; j < this.threadingNow.length; j++) {
        if (this.threadingLast[i] == this.threadingNow[j]) {
          fresh = true;
        }
      }
      if (!fresh) { //clears stale rectangles (note: the y-coordinate saved in both threading lists are "upside down" hence the subtraction from this.threadingSize, there was still an offset by 20, so this was subtracted as well)
        this.cxThreading.clearRect((this.threadingLast[i][0] * 20)+1, (this.threadingSize-(this.threadingLast[i][1] * 20)-20+1), 18,18);
      }
    }
    this.threadingLast = [];
    //marking all of the fresh rectangles
    for (var i =0; i < this.threadingNow.length; i++) {
      this.cxThreading.strokeRect((this.threadingNow[i][0]*20)+2, (this.threadingSize-(this.threadingNow[i][1]*20)-20)+2,16,16);
      this.cxThreading.fillRect((this.threadingNow[i][0]*20)+2, (this.threadingSize-(this.threadingNow[i][1]*20)-20)+2,16,16);
      this.threadingLast.push(this.threadingNow[i]);
    }
    this.threadingNow = [];
  }

  public redrawTreadling() {
    for (var i = 0; i < this.weave.treadling.treadling.length; i++) {
      for (var j= 0; j < this.weave.treadling.treadling[i].length; j++) {
        if(this.weave.treadling.treadling[i][j]) {
          this.treadlingNow.push([j,i]);
        }
      }
    }

    for (var i =0; i < this.treadlingLast.length; i++) {
      var fresh = false;
      for (var j=0; j < this.treadlingNow.length; j++) {
        if (this.treadlingLast[i] == this.treadlingNow[j]) {
          fresh = true;
        }
      }
      if (!fresh) {
        this.cxTreadling.clearRect((this.treadlingLast[i][0]*20)+1, (this.treadlingLast[i][1]*20)+1,18,18);
      }
    }

    this.treadlingLast = [];
    for(var i =0; i < this.treadlingNow.length; i++) {
      this.cxTreadling.strokeRect((this.treadlingNow[i][0]*20)+2, (this.treadlingNow[i][1]*20)+2,16,16);
      this.cxTreadling.fillRect((this.treadlingNow[i][0]*20)+2, (this.treadlingNow[i][1]*20)+2,16,16);
      this.treadlingLast.push(this.treadlingNow[i]);    
    }
    this.treadlingNow = [];
  }


  public redrawDrawdown() {
    for (var i = 0; i < this.weave.pattern.length;i++) {
      this.redrawRow(i*20,i,this.cx);
    }
  }
  /**
   * Redraws the entire canvas based on weave pattern.
   * @extends WeaveDirective
   * @returns {void}
   */
  public redraw(cx, canvas, type) {
    var i,j;
    cx.clearRect(0,0, canvas.width, canvas.height);
    this.drawGrid(cx,canvas);

    var color = '#000000';
    cx.fillStyle = color;
    if(type == "pattern") {
      for (i = 0; i < this.weave.visibleRows.length; i++) {
        var row = this.weave.visibleRows[i];
        this.redrawRow(i * 20, i, cx);
      }
    } else if (type == "threading") {
      this.redrawLastThreading();
    } else if (type == "tieups") {

    } else if (type == "treadling") {

    }
  }

  /**
   * Simulates the visual look of the weave pattern.
   * @extends WeaveDirective
   * @returns {void}
   */
  public simulate() {
    var color = '#000000';
    var offset;
    var height = 0;

    for (var i = 0; i < this.weave.wefts; i++) {
      var shuttleId = this.weave.rowShuttleMapping[i];
      var t = this.weave.shuttles[shuttleId].getThickness();
      if (t !== undefined) {
        height += Math.ceil((this.weave.wpi / t) * 20);
      }
    }

    this.canvasEl.height = height;

    this.cx.clearRect(0,0, this.canvasEl.width, this.canvasEl.height);

    var i = 0;
    var y = 0;
    while (y < this.canvasEl.height) {
      color = this.weave.getColor(i);
      var l = this.weave.rowShuttleMapping[i];
      var h = Math.ceil((this.weave.wpi / this.weave.shuttles[l].getThickness()) * 20);
      for (var x = 0; x < this.weave.warps * 20; x += 20) {
        if (!this.weave.isUp(i , x / 20)) {
          this.cx.fillStyle = color;
          this.cx.fillRect(x, y, 20, h);
        } else {
          this.cx.fillStyle = '#000000';
          this.cx.fillRect(x, y, 20, h );
        }
      }

      i++;
      y += h;
    }
  }

  /**
   * Resizes and then redraws the canvas on a change to the wefts or warps. 
   * @extends WeaveDirective
   * @returns {void}
   */
  public updateSize() {
    // set the updated width and height
    this.canvasEl.width = this.weave.warps * 20;
    this.canvasEl.height = this.weave.visibleRows.length * 20;

    // redraw the 
    this.redraw(this.cx, this.canvasEl, "pattern");
  }

  /**
   * Resizes and then redraws the threading canvas on a change to the number of used frames (if this change is such that the number of used frames is greater than 8). 
   * @extends WeaveDirective
   * @returns {void}
   */
  public updateSizeThreading() {
    //shifts the shuttle location down by 20 corresponding to space needed for the added frame
    var temp = this.shuttleLocation + 20;
    var stringShuttleLocation = temp.toString() + "px";
    this.shuttleLocation = temp;
    this.el.nativeElement.children[6].style.top = stringShuttleLocation;
    this.el.nativeElement.children[5].style.top = stringShuttleLocation;
    this.threadingCanvas.height = this.weave.threading.usedFrames.length * 20;
    this.threadingSize = this.weave.threading.usedFrames.length * 20;
    this.tieupsCanvas.height = this.weave.threading.usedFrames.length * 20;
    this.redraw(this.cxThreading, this.threadingCanvas, "threading");
    this.redraw(this.cxTieups, this.tieupsCanvas, "tieups");
  }

  /**
   * Resizes and then redraws the treadling canvas on a change to the number of used treadles (if this change is such that the number of used frames is greater than 10). 
   * @extends WeaveDirective
   * @returns {void}
   */
  public updateSizeTreadling() {
    this.treadles = this.weave.treadling.treadle_count;
    this.treadlingCanvas.width = this.treadles *20;
    this.tieupsCanvas.width = this.treadles*20;
    this.redraw(this.cxTreadling, this.treadlingCanvas, "treadling");
    this.redraw(this.cxTieups, this.tieupsCanvas, "tieups");
  }

  public onUndoRedo() {
    console.log("undoredo-weave directive")
    this.undoRedoSegment();
  }

  /**
   * Prints the pattern to the console.
   * @extends WeaveDirective
   * @param {Array<Array<boolean>>} pattern - 2D pattern array.
   * @returns {void}
   */
  public printPattern(pattern) {
    for (var i = 0; i < pattern.length; i++) {
      var s = "";
      for (var j = 0; j < pattern[0].length; j++) {
        if (pattern[i][j]) {
          s += 'x';
        } else {
          s += 'o'
        }
      }
      console.log(s);
    }
  }

  /**
   * Saves the draft as a bitmap file
   * @extends WeaveDirective
   * @param {string} fileName - name to save file as
   * @returns {void}
   */
  public savePNG(fileName, obj) {
    let link = obj.downloadLink.nativeElement;

    link.href = this.canvasEl.toDataURL("image/png");
    link.download = fileName + ".png";
    console.log(link);
  }

  /**
   * Saves the draft as a bitmap file
   * @extends WeaveDirective
   * @param {string} fileName - name to save file as
   * @returns {void}
   */
  public saveBMP(fileName, obj) {
    let b = obj.bitmap.nativeElement;
    let context = b.getContext('2d');
    let draft = this.weave.pattern;
    var i,j;

    b.width = this.weave.warps;
    b.height = this.weave.wefts;
    context.fillStyle = "white";
    context.fillRect(0,0,b.width,b.height);

    context.fillStyle = "black";

    for(i = 0; i < b.height; i++) {
      for(j=0; j < b.width; j++) {
        let up = draft[i][j];
        if(up) {
          context.fillRect(j,i,1,1)
        }
      }
    }

    let link = obj.downloadLink.nativeElement;

    link.href = CanvasToBMP.toDataURL(b);
    link.download = fileName + ".bmp";
  }

  /**
   * Saves the draft as a .ada file
   * @extends WeaveDirective
   * @param {string} fileName - name to save file as
   * @returns {void}
   */
  public saveADA(fileName, obj) {


    console.log("save ADA", this.weave);

    var theJSON = JSON.stringify(this.weave);
    console.log(theJSON);
    var uri = "data:application/json;charset=UTF-8," + encodeURIComponent(theJSON);
    console.log(uri);
    let link = obj.downloadLink.nativeElement;
    link.href = uri;
    link.download = fileName + ".ada";
  }

  // History


  private onAdd(segment: DraftSegment) {
    this.store.dispatch(new AddAction(segment));
  }

}
