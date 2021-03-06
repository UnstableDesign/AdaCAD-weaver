import { Injectable } from '@angular/core';
import { elementAt } from 'rxjs/operators';

interface DesignMode{
  value: string;
  viewValue: string;
  icon: string;
  children: Array<DesignMode>;
  enable_inks: boolean;
  selected: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class DesignmodesService {


  modes: Array<DesignMode>;
  selected: Array<DesignMode>;

/**
 * Creates the objects that track which design mode (draw, select, etc) the user is currently working in. 
 */
  constructor() { 

    this.selected = [];

    const shapes:Array<DesignMode> = [
      {value: 'line', viewValue: 'Line', icon: "fas fa-slash", children: [], enable_inks: true, selected: false},
      {value: 'fill_circle', viewValue: 'Filled Circle', icon: "fas fa-circle", children: [], enable_inks: true, selected: false},
      {value: 'stroke_circle', viewValue: 'Circle Outline', icon: "far fa-circle", children: [], enable_inks: true, selected: false},
      {value: 'fill_rect', viewValue: 'Filled Rectangle', icon: "fas fa-square", children: [], enable_inks: true, selected: false},
      {value: 'stroke_rect', viewValue: 'Rectangle Outline', icon: "far fa-square", children: [], enable_inks: true, selected: false},
      {value: 'free', viewValue: 'Freehand', icon: "fas fa-draw-polygon", children: [], enable_inks: true, selected: false},
    ]

    
  
  this.modes = [
    {value: 'draw', viewValue: 'Draw', icon: "fas fa-pen", children: [], enable_inks: true, selected: false},
    {value: 'shape', viewValue: 'Shape', icon: "fas fa-shapes", children: shapes, enable_inks: true, selected: false},
    {value: 'select', viewValue: 'Cut/Create', icon: "fas fa-expand", children: [], enable_inks: false, selected:false},
    {value: 'move', viewValue: 'Move', icon: "fas fa-arrows-alt", children: [], enable_inks: false, selected:false},
    {value: 'operation', viewValue: 'Operations', icon: "fas fa-project-diagram", children: [], enable_inks: false, selected:false},
  ];

  this.select('draw');

  console.log("selected", this.selected);
  
  }


  /**
   * A function to retreive a mode by name. Only works if modes are nested no more than 1 deep. 
   * @param name the name of the component we're looking to retreive
   * @returns the DeisgnMode associated with that name, or null if nothing was found
   */

  getMode(name: string): DesignMode {
   let found: DesignMode = null;

   this.modes.forEach( mode => {
      if(mode.value === name) found =  mode;
      mode.children.forEach(child => {
        if(child.value === name) found = child;
      });
   });
   return found;
  }

  /**
   * sets false to the selection parameter on all the modes. 
   */
  clearSelection(){
    this.selected.forEach( mode => {
      mode.selected = false;
    });
    this.selected = [];
  }

/**
 * clears previous selections and selects both parent and child mode associated with name
 * @param name a string corresponding to the name of this mode
 * @returns boolean cooresponding to whether or no a selection was made 
 */
  select(name: string): boolean{

    let found: boolean = false;
    this.clearSelection();

    this.modes.forEach( mode => {
      if(mode.value === name){
        mode.selected = true;
        found = true;
        this.selected.push(mode);
      } 
      mode.children.forEach(child => {
        if(child.value === name){
          mode.selected = true;
          child.selected = true;
          found = true;
          this.selected.push(mode);
          this.selected.push(child);
        } 
      });
   });

   return found;
  }



  /**
   * Get the current modes that are selected
   * @returns returns the collection of selected modes
   */
  getSelected():Array<DesignMode>{
    return this.selected;
  }

  /**
   * Get the current shape that is selected or null if no shape is selected
   * @returns returns the collection of selected modes
   */
    getSelectedShapeName():string{
      const shapes:DesignMode = this.getMode('shape');
      shapes.children.forEach(child => {
        if(child.selected) return child.viewValue;
      });
      return "";
  }
  
  /**
   * checks if a user specified mode is selected
   * @param name the name of the mode we are asking about
   * @returns boolean describing if it was selected or not
   */
  isSelected(name:string):boolean{
    const found:DesignMode = this.selected.find(el => el.value == name);
    return (found === undefined) ? false : true;
  }

  selectedHasInkEnabled():boolean{
    let enabled:boolean = false;
    const modes: Array<DesignMode> = this.getSelected();
    modes.forEach(mode =>{
     enabled = mode.enable_inks;
    });
    return enabled;
  }
 

}
