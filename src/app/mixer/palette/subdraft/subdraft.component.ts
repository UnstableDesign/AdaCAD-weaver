import { Component, OnInit, Input, Output, EventEmitter, ElementRef} from '@angular/core';
import { Draft } from '../../../core/model/draft';
import { ConnectionComponent } from '../connection/connection.component';


interface Point {
  x: number;
  y: number;
}

interface Interlacement {
  i:number;
  j:number;
}

interface DesignActions{
  value: string;
  viewValue: string;
  icon: string;
}

@Component({
  selector: 'app-subdraft',
  templateUrl: './subdraft.component.html',
  styleUrls: ['./subdraft.component.scss']
})



export class SubdraftComponent implements OnInit {

  @Input()  draft: Draft;
  @Input()  patterns: any;
  @Input()  parent: ConnectionComponent;
  @Input()  children: Array<ConnectionComponent>;
  @Output() onSubdraftMove = new EventEmitter <any>(); 
  @Output() onSubdraftDrop = new EventEmitter <any>(); 
  @Output() onSubdraftStart = new EventEmitter <any>(); 

 //operations you can perform on a selection 
 design_actions: DesignActions[] = [
  {value: 'toggle', viewValue: 'Invert Region', icon: "fas fa-adjust"},
  {value: 'flip_x', viewValue: 'Vertical Flip', icon: "fas fa-arrows-alt-v"},
  {value: 'flip_y', viewValue: 'Horizontal Flip', icon: "fas fa-arrows-alt-h"},
  {value: 'shift_left', viewValue: 'Shift 1 Warp Left', icon: "fas fa-arrow-left"},
  {value: 'shift_up', viewValue: 'Shift 1 Pic Up', icon: "fas fa-arrow-up"},
  {value: 'copy', viewValue: 'Copy Selected Region', icon: "fa fa-clone"},
  {value: 'paste', viewValue: 'Paste Copyed Pattern to Selected Region', icon: "fa fa-paste"},
  {value: 'delete', viewValue: 'Delete this Draft', icon: "fa fa-trash"}
];


  canvas: HTMLCanvasElement;
  cx: any;

  topleft = {x: 0, y: 0}; //this is an internal reprsentation of the top left point
  
  size = {w: 0, h: 0};

  scale = 10; 
  filter = 'or'; //can be or, and, neq, not, splice
  counter:number  =  0; // only call functions every so often
  
  moving = false;
  draw_mode = false;
  disable_drag = false;


  constructor(private el: ElementRef) { 
        //add random position for testing
        this.topleft.x = Math.floor(Math.random() * 400 / this.scale)  * this.scale;
        this.topleft.y = Math.floor(Math.random() * 400 / this.scale)  * this.scale;
        
  }

  ngOnInit(){
    this.size.w = this.draft.warps * this.scale;
    this.size.h = this.draft.wefts * this.scale;

  }


  ngAfterViewInit() {

    this.canvas = <HTMLCanvasElement> document.getElementById(this.draft.id.toString());
    this.cx = this.canvas.getContext("2d");
    this.drawDraft(this.draft);

    console.log("after init");

  }

  public setPositionAndSize(bounds: any){
    console.log("setting to", bounds);
    this.topleft = bounds.topleft;
    this.size.w = bounds.width;
    this.size.h = bounds.height;
    console.log(this.size.h);
  }




  public filterActionChange(event: any){
    console.log(event);
    this.filter = event;

  }

  public computeFilter(a: boolean, b: boolean):boolean{

    if(a === null && b === null) return null;

    if(a === null) return b;
    if(b === null) return a;

    if(this.filter === "or")  return (a || b);
    if(this.filter === "and")  return (a && b);
    if(this.filter === "neq")  return (a !== b);
    if(this.filter === "inv")  return (!b);


  }

  public hasPoint(p:Point) : boolean{

      const endPosition = {
        x: this.topleft.x + this.size.w,
        y: this.topleft.y + this.size.h,
      };

      if(p.x < this.topleft.x || p.x > endPosition.x) return false;
      if(p.y < this.topleft.y || p.y > endPosition.y) return false;

    
    return true;

  }


  public resolvePoint(p:Point) : Interlacement{
    
    let i = Math.floor((p.y -this.topleft.y) / this.scale);
    let j = Math.floor((p.x - this.topleft.x) / this.scale);

    if(i < 0 || i >= this.draft.wefts) i = -1;
    if(j < 0 || j >= this.draft.warps) j = -1;

    return {i: i, j:j};

  }


  //takes an absolute reference and returns boolean or null if its unset
  public resolveToValue(p:Point) : boolean{

    const coords = this.resolvePoint(p);

    if(coords.i < 0 || coords.j < 0) return null; //this out of range

    if(!this.draft.pattern[coords.i][coords.j].isSet()) return null;
    
    return this.draft.pattern[coords.i][coords.j].isUp();
  
  }

  setNewDraft(bounds: any, temp: Draft) {
    
    this.size.w = temp.warps * this.scale;
    this.size.h = temp.wefts * this.scale;
    this.topleft = bounds.topleft; //adjusts to the top left of the new bounding box
    this.draft = temp;

  }

     

  drawDraft(draft: Draft) {

    console.log("drawing", draft, this.canvas, this.cx);
    
    // this.canvas.width = this.size.w;
    // this.canvas.height = this.size.h;

    for (let i = 0; i < draft.visibleRows.length; i++) {
      
      for (let j = 0; j < draft.warps; j++) {
        let row:number = draft.visibleRows[i];
    
        let is_up = draft.isUp(row,j);
        let is_set = draft.isSet(row, j);
        if(is_set){
          this.cx.fillStyle = (is_up) ?  '#000000' :  '#ffffff';
          this.cx.fillRect(j*this.scale, i*this.scale, this.scale, this.scale);
        } else{
          this.cx.fillStyle =  '#DDDDDD' ;
          this.cx.fillRect(j*this.scale, i*this.scale, this.scale, this.scale);
        }
 
      }
    }
  }


  snapToGrid(p: Point):Point{

    p.x = Math.floor(p.x / this.scale) * this.scale;
    p.y = Math.floor(p.y / this.scale) * this.scale;
    return p;

  }
  
  dragEnd($event: any) {
    this.moving = false;
    this.counter = 0;  
    this.onSubdraftDrop.emit({id: this.draft.id});
  }

  dragStart($event: any) {
    this.moving = true;
    this.counter = 0;  
    this.onSubdraftStart.emit({id: this.draft.id});
  }

  dragMove($event: any) {
    //position of pointer of the page
    const pointer = $event.pointerPosition;
   
    const relative = {
      x: pointer.x, 
      y: pointer.y - 64 //pointer position is relative to window, not this parent div.
    }

    const adj = this.snapToGrid(relative);
    this.topleft = adj;

    if(this.counter%1 === 0){
      this.onSubdraftMove.emit({id: this.draft.id});
      this.counter = 0;
    } 
    this.counter++;
  }


  designActionChange(e){
    console.log(e);

    switch(e){
      // case 'copy': this.copyEvent(e);
      // break;

      // case 'duplicate': this.duplicate(e, 'original');
      // break;

      case 'toggle': this.pasteEvent('invert');
      break;

      case 'flip_x': this.pasteEvent('mirrorX');
      break;

      case 'flip_y': this.pasteEvent('mirrorY');
      break;

      case 'shift_left': this.pasteEvent('shiftLeft');
      break;

      case 'shift_up': this.pasteEvent('shiftUp');
      break;

    }
  }

    fill(id) {
      var p = this.patterns[id].pattern;
      console.log(p);
      //need a way to specify an area within the fill
      this.draft.fill(p, 'original');
      this.drawDraft(this.draft);

    }

    // copyEvent(e) {
    //   this.onCopy();
    // }

    clearEvent(b:boolean) {
     // this.onClear(b);
    }

    pasteEvent(type) {

      var p = this.draft.pattern;
      console.log("paste event", type, p);

      if(type === undefined) type = "original";

     this.draft.fill(p, type);
     this.drawDraft(this.draft);



    }
    
    /**
  //  * Tell the weave directive to fill selection with pattern.
  //  * @extends WeaveComponent
  //  * @param {Event} e - fill event from design component.
  //  * @returns {void}
  //  */
  // public onFill(e) {
    
  //   var p = this.patterns[e.id].pattern;
  //   console.log(p);
    

  //   //need a way to specify an area within the fill
  //   this.draft.fill(p, 'original');
  //   this.drawDraft(this.draft);


  //   // if(this.render.showingFrames()) this.draft.recomputeLoom();

  //   // if(this.render.isYarnBasedView()) this.draft.computeYarnPaths();
    
  //   // this.palette.redraw({drawdown:true, loom:true});

  //   // this.timeline.addHistoryState(this.draft);
    
  // }

  /**
   * Tell weave reference to clear selection.
   * @extends WeaveComponent
   * @param {Event} Delte - clear event from design component.
   * @returns {void}
   */
  public onClear(b:boolean) {
    
    // this.draft.fillArea(this.palette.selection, [[b]], 'original')

    // this.palette.copyArea();

    // this.palette.redraw({drawdown:true, loom:true});

    // this.timeline.addHistoryState(this.draft);

  }

 
  /**
   * Tells weave reference to paste copied pattern.
   * @extends WeaveComponent
   * @param {Event} e - paste event from design component.
   * @returns {void}
   */
  public onPaste(e) {

     var p = this.draft.pattern;
     var type;

    if(e.type === undefined) type = "original";
    else type =  e.type;

     this.draft.fill(p, type);
     this.drawDraft(this.draft);

    // if(this.render.showingFrames()) this.draft.recomputeLoom();
    
    // if(this.render.isYarnBasedView()) this.draft.computeYarnPaths();

    // this.timeline.addHistoryState(this.draft);

    // this.palette.copyArea();

    // this.palette.redraw({drawdown:true, loom:true, weft_materials: true, warp_materials:true, weft_systems:true, warp_systems:true});
 

  }




}