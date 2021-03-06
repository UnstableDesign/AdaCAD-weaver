import { Component, ElementRef, OnInit, OnDestroy, HostListener, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import {enableProdMode} from '@angular/core';

import { PatternService } from '../core/provider/pattern.service';
import { WeaveDirective } from './directives/weave.directive';
import { ScrollDispatcher } from '@angular/cdk/overlay';
import { Timeline } from '../core/model/timeline';
import { LoomTypes, MaterialTypes, ViewModes, DensityUnits } from '../core/model/datatypes';
import { Draft } from '../core/model/draft';
import { Render } from '../weaver/model/render';
import { Pattern } from '../core/model/pattern';
import { MatDialog } from "@angular/material/dialog";
import { InitModal } from '../core/modal/init/init.modal';
import { LabelModal } from './modal/label/label.modal';
import {Subject} from 'rxjs';
import { Cell } from '../core/model/cell';
import { FileService, LoadResponse } from '../core/provider/file.service';
import { Loom } from '../core/model/loom';
import * as _ from 'lodash';


//disables some angular checking mechanisms
// enableProdMode();


interface DesignModes{
  value: string;
  viewValue: string;
  icon: string;
}

interface DesignActions{
  value: string;
  viewValue: string;
  icon: string;
}



@Component({
  selector: 'app-weaver',
  templateUrl: './weaver.component.html',
  styleUrls: ['./weaver.component.scss']
})
export class WeaverComponent implements OnInit {
 
  /**
   * The reference to the weave directive.
   * @property {WeaveDirective}
   */
  @ViewChild(WeaveDirective, {static: false}) weaveRef;
  @ViewChild('bitmapImage', {static: false}) bitmap;



  design_modes: DesignModes[]=[
    {value: 'toggle', viewValue: 'Toggle Heddle', icon: "fas fa-adjust"},
    {value: 'up', viewValue: 'Set Heddle Up', icon: "fas fa-square"},
    {value: 'down', viewValue: 'Set Heddle Down', icon: "far fa-square"}
  ];

    //operations you can perform on a selection 
    design_actions: DesignActions[] = [
      {value: 'toggle', viewValue: 'Invert Region', icon: "fas fa-adjust"},
      {value: 'up', viewValue: 'Set Region Heddles Up', icon: "fas fa-square"},
      {value: 'down', viewValue: 'Set Region Heddles Down', icon: "far fa-square"},
      {value: 'flip_x', viewValue: 'Vertical Flip', icon: "fas fa-arrows-alt-v"},
      {value: 'flip_y', viewValue: 'Horizontal Flip', icon: "fas fa-arrows-alt-h"},
      {value: 'shift_left', viewValue: 'Shift 1 Warp Left', icon: "fas fa-arrow-left"},
      {value: 'shift_up', viewValue: 'Shift 1 Pic Up', icon: "fas fa-arrow-up"},
      {value: 'copy', viewValue: 'Copy Selected Region', icon: "fa fa-clone"},
      {value: 'paste', viewValue: 'Paste Copyed Pattern to Selected Region', icon: "fa fa-paste"}
    ];
  

  /**
   * The name of the current selected brush.
   * @property {string}
   */
  design_mode = {
    name:'toggle',
    id: -1
  }

  /**
   * The weave Draft object.
   * @property {Draft}
   */
  draft: Draft;

  /**
   * The weave Loom object.
   * @property {Loom}
   */
  loom: Loom;


 /**
   * The weave Render object.
   * @property {Render}
   */
  render: Render;

 /**
   * The weave Timeline object.
   * @property {Timeline}
   */
  timeline: Timeline = new Timeline();

 /**
   * A collection of patterns to use in this space
   * @property {Timeline}
   */
  patterns: Array<Pattern>;


  /**
  The current selection, as boolean array 
  **/
  copy: Array<Array<boolean>>;


 /**
   * The types of looms this version will support.
   * @property {LoomType}
   */
  loomtypes: LoomTypes[] = [
    {value: 'frame', viewValue: 'Shaft'},
    {value: 'jacquard', viewValue: 'Jacquard'}
  ];


  material_types: MaterialTypes[] = [
    {value: 0, viewValue: 'Non-Conductive'},
    {value: 1, viewValue: 'Conductive'},
    {value: 2, viewValue: 'Resistive'}
  ];

  density_units: DensityUnits[] = [
    {value: 'in', viewValue: 'Ends per Inch'},
    {value: 'cm', viewValue: 'Ends per 10cm '}
  ];

  view_modes: ViewModes[] = [
      {value: 'visual', viewValue: 'Visual'},
      {value: 'pattern', viewValue: 'Draft'},
      {value: 'yarn', viewValue: 'Circuit'}
     // {value: 'mask', viewValue: 'Masks'}

    ];





  /**
   * The list of all patterns saved. Provided by pattern service.
   * @property {Array<Pattern>}
   */
  //patterns;


  selected;

  private unsubscribe$ = new Subject();

  collapsed:boolean = false;
  dims:any;

  draftelement:any;
  scrollingSubscription: any;

  /// ANGULAR FUNCTIONS
  /**
   * @constructor
   * ps - pattern service (variable name is initials). Subscribes to the patterns and used
   * to get and update stitches.
   * dialog - Anglar Material dialog module. Used to control the popup modals.
   */
  constructor(
    private ps: PatternService, 
    private dialog: MatDialog, 
    private fs: FileService,
    public scroll: ScrollDispatcher) {


    this.scrollingSubscription = this.scroll
          .scrolled()
          .subscribe((data: any) => {
            this.onWindowScroll(data);
    });


    //initialize with a draft so that we can load some things faster. 
    //let d =  this.getDraftFromLocalStore();
    
    this.copy = [[false,true],[false,true]];



    //if(d !== undefined) this.draft = new Draft(JSON.parse(d));
    this.draft = new Draft({wefts: 80, warps: 100});
    this.loom = new Loom(this.draft, 8, 10);
    this.render = new Render(true, this.draft);
    this.draft.computeYarnPaths();

    this.timeline.addHistoryState(this.draft);  
    this.patterns = [];

    this.ps.getPatterns().subscribe((res) => {
       for(var i in res.body){
          this.patterns.push(new Pattern(res.body[i]));
       }
    }); 

    this.render.view_frames = (this.loom.type === 'frame') ? true : false;     
    if (this.patterns === undefined) this.patterns = this.patterns;

  }

  private onWindowScroll(data: any) {
    this.weaveRef.rescale();
  }



  loadNewFile(result: LoadResponse){

    console.log("loading new file", result);
    const data = result.data;
    if(data.drafts.length > 0){
      this.draft.reload(data.drafts[0]);
    }else{
      console.log("ERROR, there were not drafts associated with this file");
    }

    if(data.looms.length > 0){
      this.loom.copy(data.looms[0]);
      const success: boolean = this.loom.overloadDraft(this.draft);
      if(!success) console.log("ERROR, could not attach loom to draft of different size");
    }else{
      console.log("WARNING, there were no looms associated with this file");
      this.loom.clearAllData(this.draft.warps, this.draft.wefts);
      this.loom.recomputeLoom(this.draft);

      const success: boolean = this.loom.overloadDraft(this.draft);
      if(!success) console.log("ERROR, could not attach loom to draft of different size");
    }

    if(data.patterns.length > 0){
      this.patterns = data.patterns;
    }

    this.draft.computeYarnPaths();
    this.timeline.addHistoryState(this.draft);
    
    this.render.view_frames = (this.loom.type === 'frame') ? true : false;     
    this.render.updateVisible(this.draft);
    

    this.weaveRef.onNewDraftLoaded();


    this.weaveRef.redraw({
      drawdown: true, 
      loom:true, 
      warp_systems: true, 
      weft_systems: true, 
      warp_materials: true,
      weft_materials:true
    });

    this.weaveRef.rescale();

  }
  
  ngOnInit(){
    
  }

  ngAfterViewInit() {

  
    const dialogRef = this.dialog.open(InitModal, {
      data: {loomtypes: this.loomtypes, density_units: this.density_units, source: "weaver"}
    });


    dialogRef.afterClosed().subscribe(result => {
      if(result !== undefined) this.loadNewFile(result);
   });


    this.weaveRef.onNewDraftLoaded();

    this.weaveRef.redraw({
      drawdown: true, 
      loom:true, 
      warp_systems: true, 
      weft_systems: true, 
      warp_materials: true,
      weft_materials:true
    });

    this.weaveRef.rescale();
  
    
  }


  ngOnDestroy(): void {
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }

  undo() {
    let d: Draft = this.timeline.restorePreviousHistoryState();
    console.log("Prevous State is ", d);
    if(d === undefined || d === null) return;

    this.draft.reload(d);    
    this.weaveRef.onNewDraftLoaded();
    this.weaveRef.redraw({
      drawdown: true, 
      loom:true, 
      warp_systems: true, 
      weft_systems: true, 
      warp_materials: true,
      weft_materials:true
    });

    this.weaveRef.rescale(); 
  }

  redo() {
    let d: Draft = this.timeline.restoreNextHistoryState();
    console.log("Next State is ", d);

    if(d === undefined || d === null) return;

    console.log(d);

    this.draft.reload(d);    
    this.weaveRef.onNewDraftLoaded();
    this.weaveRef.redraw({
      drawdown: true, 
      loom:true, 
      warp_systems: true, 
      weft_systems: true, 
      warp_materials: true,
      weft_materials:true
    });

    this.weaveRef.rescale(); 
  }

  /// EVENTS




/**
   * Call zoom in on Shift+p.
   * @extends WeaveComponent
   * @param {Event} shift+p
   * @returns {void}
   */
  @HostListener('window:keydown.Shift.p', ['$event'])
  private keyEventZoomIn(e) {
    console.log("zoom in");
    this.render.zoomIn();
    this.weaveRef.rescale();


  }
/**
   * Call zoom out on Shift+o.
   * @extends WeaveComponent
   * @param {Event} shift+o
   * @returns {void}
   */
  @HostListener('window:keydown.Shift.o', ['$event'])
  private keyEventZoomOut(e) {
    console.log("zoom out");
    this.render.zoomOut();
    this.weaveRef.rescale();
  }


  /**
   * Sets selected area to clear
   * @extends WeaveComponent
   * @param {Event} delete key pressed
   * @returns {void}
   */

  @HostListener('window:keydown.e', ['$event'])
  private keyEventErase(e) {
    this.design_mode = {
      name: 'down',
      id: -1
    };
    this.weaveRef.unsetSelection();

  }

  /**
   * Sets brush to point on key control + d.
   * @extends WeaveComponent
   * @param {Event} e - Press Control + d
   * @returns {void}
   */
  @HostListener('window:keydown.d', ['$event'])
  private keyEventPoint(e) {
    this.design_mode = {
      name: 'up',
      id: -1};
    this.weaveRef.unsetSelection();

  }

  /**
   * Sets brush to select on key control + s
   * @extends WeaveComponent
   * @param {Event} e - Press Control + s
   * @returns {void}
   */
  @HostListener('window:keydown.s', ['$event'])
  private keyEventSelect(e) {
    this.design_mode = {
      name: 'select',
      id: -1};
    this.weaveRef.unsetSelection();

  }

  /**
   * Sets key control to invert on control + x
   * @extends WeaveComponent
   * @param {Event} e - Press Control + x
   * @returns {void}
   */
  @HostListener('window:keydown.x', ['$event'])
  private keyEventInvert(e) {
    this.design_mode = {
      name: 'toggle',
      id: -1
    };
    this.weaveRef.unsetSelection();

  }

  /**
   * Sets key to copy 
   * @extends WeaveComponent
   * @param {Event} e - Press Control + x
   * @returns {void}
   */
  // @HostListener('window:keydown.c', ['$event'])
  // private keyEventCopy(e) {
  //   this.onCopy();  
  // }

    /**
   * Sets key to copy 
   * @extends WeaveComponent
   * @param {Event} e - Press Control + x
   * @returns {void}
   */
  @HostListener('window:keydown.p', ['$event'])
  private keyEventPaste(e) {
    this.onPaste({});
  }

  /**
   * Updates the canvas based on the weave view.
   * @extends WeaveComponent
   * @param {Event} e - view change event from design component.
   * @returns {void}
   */
  public viewChange(value: any) {
    
    this.render.setCurrentView(value);

    if(this.render.isYarnBasedView()) this.draft.computeYarnPaths();

    this.weaveRef.redraw({
      drawdown: true
    });
  }

  /**
   * Change the name of the brush to reflect selected brush.
   * @extends WeaveComponent
   * @param {Event} e - brush change event from design component.
   * @returns {void}
   */
  public onDesignModeChange(e:any) {

    this.design_mode = {
      name: e.name,
      id: e.id
    }

    console.log("design mode", this.design_mode.name, this.design_mode.id);
    this.weaveRef.unsetSelection();

  }

  /**
   * Tell the weave directive to fill selection with pattern.
   * @extends WeaveComponent
   * @param {Event} e - fill event from design component.
   * @returns {void}
   */
  public onFill(e) {
    
    let p:Pattern = this.patterns[e.id];
    
    this.draft.fillArea(this.weaveRef.selection, p, 'original', this.render.visibleRows, this.loom);

    if(this.render.showingFrames()) this.loom.recomputeLoom(this.draft);

    if(this.render.isYarnBasedView()) this.draft.computeYarnPaths();
    
    this.weaveRef.copyArea();

    this.weaveRef.redraw({drawdown:true, loom:true});

    this.timeline.addHistoryState(this.draft);
    
  }

  /**
   * Tell weave reference to clear selection.
   * @extends WeaveComponent
   * @param {Event} Delte - clear event from design component.
   * @returns {void}
   */
  public onClear(b:boolean) {
    
    const c: Cell = new Cell(b);
    const p: Pattern = new Pattern({width: 1, height: 1, pattern: [[c]]});

    this.draft.fillArea(this.weaveRef.selection, p, 'original', this.render.visibleRows, this.loom)

    if(this.render.showingFrames()) this.loom.recomputeLoom(this.draft);

    if(this.render.isYarnBasedView()) this.draft.computeYarnPaths();

    this.weaveRef.copyArea();

    this.weaveRef.redraw({drawdown:true, loom:true});

    this.timeline.addHistoryState(this.draft);

  }

  public onScroll(){
    console.log("I has scroll");
  }

  /**
   * Weave reference masks pattern over selected area.
   * @extends WeaveComponent
   * @param {Event} e - mask event from design component.
   * @returns {void}
   */
  public onMask(e) {
    // console.log(e);
    // var p = this.draft.patterns[e.id].pattern;
    // this.weaveRef.maskArea(p);
    // this.redraw();
  }

  /**
   * Tells weave reference to paste copied pattern.
   * @extends WeaveComponent
   * @param {Event} e - paste event from design component.
   * @returns {void}
   */
  public onPaste(e) {

    var p = this.weaveRef.copy;
    console.log("on paste", e, p);


    var type;

    if(e.type === undefined) type = "original";
    else type =  e.type;

    this.draft.fillArea(this.weaveRef.selection, p, type, this.render.visibleRows, this.loom);

    switch(this.weaveRef.selection.target.id){    
      case 'drawdown':
        //if you do this when updates come from loom, it will erase those updates
        if(this.render.showingFrames()) this.loom.recomputeLoom(this.draft);
       break;
      
    }

    
    if(this.render.isYarnBasedView()) this.draft.computeYarnPaths();

    this.timeline.addHistoryState(this.draft);

    this.weaveRef.copyArea();

    this.weaveRef.redraw({drawdown:true, loom:true, weft_materials: true, warp_materials:true, weft_systems:true, warp_systems:true});
 

  }

  /**
   * Creates the copied pattern within the weave reference
   * @extends WeaveComponent
   * @param {Event} e - copy event from design component.
   * @returns {void}
   */
  public onCopy() {

    console.log("on copy", this.copy);

    this.design_mode = {
      name: 'copy',
      id: -1
    };
  }

  /**
   *
   *
   */
  public onSave(e: any) {

    e.bitmap = this.bitmap;

    if (e.type === "bmp"){
      let link = e.downloadLink.nativeElement;
      link.href = this.fs.saver.bmp(this.weaveRef.getBMPCanvas(e));
      link.download = e.name + ".jpg"; //Canvas2Bitmap  seems to be broken now
    } 
    else if (e.type === "ada"){
      let link = e.downloadLink.nativeElement;
      link.href = this.fs.saver.ada('draft', [this.draft], [this.loom], this.patterns, this.draft.notes, false);
      link.download = e.name + ".ada";
    } 
    else if (e.type === "wif"){
      let link = e.downloadLink.nativeElement;
      link.href= this.fs.saver.wif(this.draft, this.loom);
      link.download = e.filename +".wif";

    } 
    else if (e.type === "jpg"){
      let link = e.downloadLink.nativeElement;
      link.href = this.fs.saver.jpg(this.weaveRef.getPrintableCanvas(e));
      link.download = e.name + ".jpg";
    } 
    
  }

  /**
   * Open the connection modal.
   * @extends WeaveComponent
   * @returns {void}
   */
  // public openConnectionDialog() {

  //   const dialogRef = this.dialog.open(ConnectionModal, {data: {shuttles: this.draft.shuttles}});

  //   dialogRef.afterClosed().subscribe(result => {
  //     if (result) {
  //       this.draft.connections.push(result);
  //     }
  //   });
  // }


  /**
   * Open the label modal.
   * @extends WeaveComponent
   * @returns {void}
   */
  public openLabelDialog() {

    const dialogRef = this.dialog.open(LabelModal);

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        console.log(result);
      }
    });
  }



  /// PUBLIC FUNCTIONS
  /**
   * 
   * @extends WeaveComponent
   * @returns {void}
   */
  public print(e) {
    console.log(e);
  }

  /**
   * Inserts an empty row on system, system
   */
  public shuttleColorChange() {
    this.weaveRef.redraw({drawdown: true, warp_materials:true,  weft_materials:true});
    this.timeline.addHistoryState(this.draft);
  }

  /**
   * inserts an empty row just below the clicked row
   * @param i the absolute (not screen) index of the row we'll insert
   * @param shuttle the shuttle id this will be assigned to
   * @param system the system id to which this row will be assigned
   */
  public insertRow(i:number, shuttle:number, system:number) {

    console.log(i);
    this.draft.insertRow(i, shuttle, system);
    this.loom.insertRow(i);
    this.render.updateVisible(this.draft);
    this.weaveRef.redraw({drawdown: true, loom:true, weft_systems: true, weft_materials:true});
    this.timeline.addHistoryState(this.draft);

  }

  public cloneRow(i, c, shuttle, system) {
    this.draft.cloneRow(i, c, shuttle, system);
    this.loom.cloneRow(i);
    this.render.updateVisible(this.draft);
    this.weaveRef.redraw({drawdown: true, loom:true, weft_systems: true, weft_materials:true});
    this.timeline.addHistoryState(this.draft);

  }

  public deleteRow(i) {
    this.draft.deleteRow(i);
    this.loom.deleteRow(i);
    this.render.updateVisible(this.draft);
    this.weaveRef.redraw({drawdown: true, loom:true, weft_systems: true, weft_materials:true});
    this.timeline.addHistoryState(this.draft);
  }

    /**
   * In
   * @extends WeaveComponent
   * @returns {void}
   */
  public insertCol(i, shuttle,system) {
    this.draft.insertCol(i, shuttle,system);
    this.loom.insertCol(i);
    this.weaveRef.redraw({drawdown: true, loom:true, warp_systems: true, warp_materials:true});
    this.draft.computeYarnPaths();
    this.timeline.addHistoryState(this.draft);

  }

  public cloneCol(i, shuttle,system) {
    this.draft.cloneCol(i, shuttle,system);
    this.loom.cloneCol(i);
    this.weaveRef.redraw({drawdown: true, loom:true, warp_systems: true, warp_materials:true});
    this.draft.computeYarnPaths();
    this.timeline.addHistoryState(this.draft);

  }


  public deleteCol(i) {
    this.draft.deleteCol(i);
    this.loom.deleteCol(i);
    this.weaveRef.redraw({drawdown: true, loom:true, warp_systems: true, warp_materials:true});
    this.draft.computeYarnPaths();
    this.timeline.addHistoryState(this.draft);
  }

  public updatePatterns(e: any) {
    this.patterns = e.patterns;

  }

  public updateWarpSystems(pattern: Array<number>) {
    console.log("update warp sys", pattern);
    this.draft.updateWarpSystemsFromPattern(pattern);
    this.weaveRef.redraw({drawdown: true, warp_systems: true});

  }

  public updateWeftSystems(pattern: Array<number>) {
    console.log("update weft sys", pattern);

    this.draft.updateWeftSystemsFromPattern(pattern);
    this.weaveRef.redraw({drawdown: true, weft_systems: true});

  }

  public updateWarpShuttles(pattern: Array<number>) {
    console.log("update warp shut", pattern);

    this.draft.updateWarpShuttlesFromPattern(pattern);
    this.weaveRef.redraw({drawdown: true, warp_materials: true});

  }

  public updateWeftShuttles(pattern: Array<number>) {
    console.log("update weft shutf", pattern);

    this.draft.updateWeftShuttlesFromPattern(pattern);
    this.draft.computeYarnPaths();
    this.weaveRef.redraw({drawdown: true, weft_materials: true});

  }

  // public createMaterial(e: any) {
  //   this.draft.addMaterial(e.material); 
  //   this.weaveRef.redraw();
  // }

  public createShuttle(e: any) {
    this.draft.addShuttle(e.shuttle, this.loom.epi); 
  }

  public createWarpSystem(e: any) {
    this.draft.addWarpSystem(e.system);
  }

  public createWeftSystem(e: any) {
    this.draft.addWarpSystem(e.system);
  }

  public hideWarpSystem(e:any) {
    
    this.weaveRef.redraw({drawdown: true, loom:true, warp_systems: true, warp_materials:true});
  }

  public showWarpSystem(e:any) {

    this.weaveRef.redraw({drawdown: true, loom:true, warp_systems: true, warp_materials:true});
  }  

  public hideWeftSystem(e:any) {
   
    this.render.updateVisible(this.draft);
    
    this.weaveRef.redraw({drawdown: true, loom:true, weft_systems: true, weft_materials:true});
  }

  public showWeftSystem(e:any) {

    this.render.updateVisible(this.draft);

    this.weaveRef.redraw({drawdown: true, loom:true, weft_systems: true, weft_materials:true});
  }


  public notesChanged(e:any) {

    console.log(e);
   this.draft.notes = e;
  }

  // public hideShuttle(e:any) {
  //   this.draft.updateVisible();
  //   this.weaveRef.redraw();
  //   this.weaveRef.redrawLoom();
  // }

  // public showShuttle(e:any) {
  //   this.draft.updateVisible();
  //   this.weaveRef.redraw();
  //   this.weaveRef.redrawLoom();
  // }

  public epiChange(e:any){
    this.loom.overloadEpi(e.epi);
  }

  public unitChange(e:any){
    this.loom.overloadUnits(e.units);
  }

  public thicknessChange(e:any){

    if(this.render.isYarnBasedView()) this.weaveRef.redraw({drawdown: true});
  }


  public loomChange(e:any){
    
    this.loom.overloadType(e.loomtype);

    if(this.loom.type == 'jacquard'){
      this.render.view_frames = false;
    }else{
      this.render.view_frames = true;
      this.weaveRef.recomputeLoom();
    }
    
    this.weaveRef.redraw({loom: true});

  }

  public frameChange(e:any){
    this.loom.setMinFrames(e.value);
    this.weaveRef.redraw({loom: true});
  }

  public treadleChange(e:any){
    this.loom.setMinTreadles(e.value);
    this.weaveRef.redraw({loom: true});
  }


  public warpNumChange(e:any) {
    if(e.warps == "") return;

    if(e.warps > this.draft.warps){
      var diff = e.warps - this.draft.warps;
      
      for(var i = 0; i < diff; i++){  
         this.draft.insertCol(i, 0,0);
         this.loom.insertCol(i);
      }
    }else{
      var diff = this.draft.warps - e.warps;
      for(var i = 0; i < diff; i++){  
        this.draft.deleteCol(this.draft.warps-1);
        this.loom.deleteCol(this.draft.warps-1);

      }

    }

    this.timeline.addHistoryState(this.draft);

    if(this.render.isYarnBasedView()) this.draft.computeYarnPaths();

    this.weaveRef.redraw({drawdown: true, loom: true, warp_systems: true, warp_materials:true});

  }

  public weftNumChange(e:any) {
  
    if(e.wefts === "" || e.wefts =="null") return;

    if(e.wefts > this.draft.wefts){
      var diff = e.wefts - this.draft.wefts;
      
      for(var i = 0; i < diff; i++){  
        this.draft.insertRow(e.wefts+i, 0, 0);
        this.loom.insertRow(e.wefts+i);
        console.log("inserting row");
      }
    }else{
      var diff = this.draft.wefts - e.wefts;
      for(var i = 0; i < diff; i++){  
        this.draft.deleteRow(this.draft.wefts-1);
        this.loom.deleteRow(this.draft.wefts-1);
      }

    }

    this.render.updateVisible(this.draft);

    this.timeline.addHistoryState(this.draft);

    if(this.render.isYarnBasedView()) this.draft.computeYarnPaths();

    this.weaveRef.redraw({drawdown: true, loom: true, weft_systems: true, weft_materials:true});


  }

  public createPattern(e: any) {
    e.pattern.id = this.patterns.length;
    this.patterns.push(e.pattern);
  }


//should this just hide the pattern or fully remove it, could create problems with undo/redo
   public removePattern(e: any) {
    this.patterns = this.patterns.filter(pattern => pattern !== e.pattern);
  }


  public updateSelection(e:any){
    this.copy = e;
  }


  public toggleViewFrames(){

    this.render.toggleViewFrames();

    if(this.render.view_frames && this.loom.type == "frame"){
      this.weaveRef.recomputeLoom();
    }

    this.weaveRef.redraw({loom:true});
   
  }

  public renderChange(e: any){
     
     if(e.source === "slider"){
        this.render.setZoom(e.value);
        this.weaveRef.rescale();

     } 

     if(e.source === "in"){
        this.render.zoomIn();
        this.weaveRef.rescale();

     } 

     if(e.source === "out"){
        this.render.zoomOut();
        this.weaveRef.rescale();

     } 
     if(e.source === "front"){
        this.render.setFront(e.checked);
        this.weaveRef.redraw({drawdown:true});
     }      
  }

  public toggleCollapsed(){
    this.collapsed = !this.collapsed;
  }






//careful! calling this from console will clear all data in local storage
public clearLocalStorage(){

  var total = 0;
  for(var x in localStorage) {
    localStorage.removeItem(x);
  }
  console.log( "LOCAL STORAGE CLEARED");
  console.log("local storage size now "+localStorage.length);
}


//call this from console when you want to write a file of the data
public downloadLocalStorage(){
  // let d_log = loadRawLog();

  // let oldest_stamp = d_log[0].timestamp;
  //   let newest_stamp =   d_log[0].timestamp


  // for(var d in d_log){
  //   if(d_log[d].timestamp > newest_stamp) newest_stamp = d_log[d].timestamp;
  //   if(d_log[d].timestamp < oldest_stamp) oldest_stamp = d_log[d].timestamp;
  // }

  //   console.log(oldest_stamp, newest_stamp);
  // let writer = createWriter(oldest_stamp+"_"+newest_stamp+".csv");
  // writer.write(["timestamp", "region", "value"]);
  // writer.write('\n');

  // for(var d in d_log){
  //   writer.write([d_log[d].timestamp, d_log[d].region, d_log[d].value]);
  //   writer.write('\n');
  // }
  // writer.close();


}


public getDraftFromLocalStore() : string{
  var aValue = localStorage.getItem("draft");
  return aValue;
}

//load raw log into memory so we can process it for the visualization
//this will be called once everytime we switch into vis mode, though log entries may be
//accumulated in the backgroudn that won't affect this
public loadRawLog(){
  //clear the log so we can load it fresh
  // console.log(Date.now());

   var d_log = [];
  // //console.log(localStorage.length);

  // for(var x in localStorage) {
  //   if(typeof(localStorage[x]) == "string"){
  //     time_region = split(x, ":")
  //     value = localStorage[x];

  //     d_log.push({
  //     timestamp: time_region[0],
  //     region: time_region[1],
  //     value: value}
  //   );
  //   }
  // }

  return d_log;

}



}
