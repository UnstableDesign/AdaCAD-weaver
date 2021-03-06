import { Injectable } from '@angular/core';
import { isBuffer } from 'lodash';
import { TreeService } from '../../mixer/provider/tree.service';
import { Cell } from '../model/cell';
import { Bounds } from '../model/datatypes';
import { Draft } from '../model/draft';
import { Loom } from '../model/loom';
import { Pattern } from '../model/pattern';
import { Shuttle } from '../model/shuttle';
import utilInstance from '../model/util';


 export interface NodeComponentProxy{
  node_id: number,
  type: string,
  active: boolean,
  bounds: Bounds; 
  draft_id: number;
 }

 export interface TreeNodeProxy{
  node: number,
  parent: number; 
  inputs: Array<number>;
  outputs: Array<number>; 
 }

 export interface OpComponentProxy{
  node_id: number,
  name: string,
  params: Array<number>; 
 }

 export interface CxnComponentProxy{
  from: number,
  to: number
 }


 export interface SaveObj{
  type: string,
  nodes: Array<NodeComponentProxy>,
  tree: Array<TreeNodeProxy>,
  drafts: Array<Draft>,
  looms: Array<Loom>,
  patterns: Array<Pattern>, 
  ops: Array<any>;
  notes: string
 }

export interface FileObj{
 nodes: Array<NodeComponentProxy>,
 treenodes: Array<TreeNodeProxy>,
 drafts: Array<Draft>,
 looms: Array<Loom>,
 patterns: Array<Pattern>, 
 ops: Array<OpComponentProxy>;
 notes: string
}

interface StatusMessage{
  id: number,
  message: string,
  success: boolean
}

export interface LoadResponse{
  data: FileObj,
  status: number;
}



interface Fileloader{
  ada: (data: any) => LoadResponse,
  wif: (data: any) => LoadResponse,
  bmp: (data: any) => LoadResponse,
  jpg: (data: any) => LoadResponse,
  form: (data: any) => LoadResponse
}

interface FileSaver{
  ada: (type: string, drafts: Array<Draft>, looms: Array<Loom>, patterns: Array<Pattern>, notes: string, for_timeline:boolean) => string,
  wif: (draft: Draft, loom: Loom) => string,
  bmp: (canvas: HTMLCanvasElement) => string,
  jpg: (canvas: HTMLCanvasElement) => string
}


/**
 * this service handles the processing of data from an uplaoded file. 
 * It is called from the InitModal when the user uploads data. 
 * The principle sholud be that you can load any .ada file into 
 * mixer or weaver, no matter what. 
 */

@Injectable({
  providedIn: 'root'
})
export class FileService {




  status: Array<StatusMessage> = [];
  loader: Fileloader = null;
  saver: FileSaver = null;


  constructor(private tree: TreeService) { 


  this.status = [
    {id: 0, message: 'success', success: true},
    {id: 1, message: 'incompatable type', success: false}
  ];


  const dloader: Fileloader = {

    ada: (data: any) : LoadResponse => {

      let drafts: Array<Draft> = [];
      let looms: Array<Loom> = [];
      let patterns: Array<Pattern> = [];
      let ops: Array<OpComponentProxy> = [];
      let notes:string =  "";

      

      //handle old file types that didn't separate out drafts
      if(data.drafts === undefined) data.drafts = [data];

      drafts = data.drafts.map(data => {
        const draft: Draft =  new Draft({wefts: data.wefts, warps: data.warps, pattern: data.pattern});
        if(data.id !== undefined) draft.overloadId(data.id);
        if(data.shuttles !== undefined) draft.overloadShuttles(data.shuttles); 
       
        if(data.weft_systems !== undefined) draft.overloadWeftSystems(data.weft_systems); 
        if(data.warp_systems !== undefined) draft.overloadWarpSystems(data.warp_systems); 
       
        if(data.rowShuttleMapping !== undefined) draft.overloadRowShuttleMapping(data.rowShuttleMapping); 
        if(data.colShuttleMapping !== undefined) draft.overloadColShuttleMapping(data.colShuttleMapping); 
        if(data.rowSystemMapping !== undefined) draft.overloadRowSystemMapping(data.rowSystemMapping); 
        if(data.colSystemMapping !== undefined) draft.overloadColSystemMapping(data.colSystemMapping);
        if(data.notes !== undefined) draft.overloadNotes(data.notes);
        if(data.name !== undefined) draft.overloadName(data.name);
        return draft; 
      });


      if(data.looms === undefined && data.loom !== undefined) data.looms = [data.loom];
      else data.looms = [];
      looms = data.looms.map((data, ndx) => {

        let draft: Draft = null;
        if(data.draft_id !== undefined) draft = drafts.find(draft => draft.id == data.id);
        else draft = drafts[ndx];

        const frames: number = (data.min_frames === undefined) ? 8 : data.min_frames;
        const treadles: number = (data.min_treadles === undefined) ? 8 : data.min_treadles;

        const loom = new Loom(draft, frames, treadles);
        if(data.type !== undefined) loom.overloadType(data.type); 
        if(data.threading !== undefined) loom.overloadThreading(data.threading);
        if(data.treadling !== undefined) loom.overloadTreadling(data.treadling);
        if(data.tieup !== undefined) loom.overloadTieup(data.tieup);
        return loom;
      });

      if(data.patterns !== undefined){
        patterns = data.patterns.map(pattern => {
          const p:Pattern = new Pattern(pattern);
          return p;
        });
      }


      if(data.ops !== undefined){
        ops = data.ops.map(data => {
          const op: OpComponentProxy = {
            node_id: data.node_id,
            name: data.name,
            params: data.params
          }
          return op;
        });
      }


      const envt: FileObj = {
        drafts: drafts,
        patterns: patterns,
        looms: looms,
        nodes: (data.nodes === undefined) ? [] : data.nodes,
        treenodes: (data.tree === undefined) ? [] : data.tree,
        ops: ops,
        notes: notes
      }

      return {data: envt, status: 0}; 


    }, 
    wif: (data: any) : LoadResponse => {

      let drafts: Array<Draft> = [];
      let looms: Array<Loom> = [];
     
      var stringWithoutMetadata = utilInstance.getSubstringAfter("CONTENTS", data);
      const warps:number = utilInstance.getInt("Threads",utilInstance.getSubstringAfter("WARP]",stringWithoutMetadata));
      const wefts:number = utilInstance.getInt("Threads",utilInstance.getSubstringAfter("WEFT]",stringWithoutMetadata));
      const pattern: Array<Array<Cell>> = [];

      for (var i = 0; i < wefts; i++) {
        pattern.push([]);
        for (var j = 0; j < warps; j++) {
          pattern[i].push(new Cell(null));
          pattern[i][j].setHeddle(false);
        }
      }
      const draft = new Draft({wefts: wefts, warps: warps, pattern: pattern});
      drafts.push(draft);
      draft.overloadName(data.name);

    let frames = utilInstance.getInt("Shafts", data);
    let treadles = utilInstance.getInt("Treadles", data);
    
    const loom:Loom = new Loom(draft, frames, treadles);
    loom.overloadType('frame');
    looms.push(loom);

    // draft.loom.tieup = []

    // for (var i = 0; i < frames; i++) {
    //   draft.loom.tieup.push([]);
    //   for (var j = 0; j < treadles; j++) {
    //     draft.loom.tieup[i].push(false);
    //   }
    // }

    if (utilInstance.getBool("TREADLING", stringWithoutMetadata)) {
      var treadling = utilInstance.getTreadling(stringWithoutMetadata, draft);
      loom.overloadTreadling(treadling);
    }
    if (utilInstance.getBool("THREADING", stringWithoutMetadata)) {
      var threading = utilInstance.getThreading(stringWithoutMetadata, draft);
      loom.overloadThreading(threading);
    }
    if (utilInstance.getBool("TIEUP", data)) {
      var tieups = utilInstance.getTieups(stringWithoutMetadata, draft);
      loom.overloadTieup(tieups);

    }
    if (utilInstance.getBool("COLOR TABLE",data)) {
      if (utilInstance.getString("Form", data) === "RGB") {
        let color_table: Array<Shuttle>  = utilInstance.getColorTable(data);
        var shuttles = color_table;
        draft.overloadShuttles(shuttles);
        draft.overloadRowShuttleMapping(utilInstance.getRowToShuttleMapping(data, draft));
        draft.overloadColShuttleMapping(utilInstance.getColToShuttleMapping(data, draft));
      }
    }

    draft.recalculateDraft(tieups, treadling, threading);


    const f: FileObj = {
      drafts: drafts,
      looms: looms,
      patterns: [],
      nodes: [], 
      treenodes: [],
      ops: [], 
      notes: ""
    }

    return {data: f ,status: 0};
    },
    /**
     * takes in a jpg, creates as many drafts as there are unique colors in the image. 
     * @param data 
     * @returns 
     */
    jpg: (data: any) : LoadResponse => {
      console.log("processing JPG data")
      let drafts: Array<Draft> = [];
      let looms: Array<Loom> = [];

      let e = data;
      const warps = e.width;
      const wefts = e.height;
  
      var img = e.data;

      let hex_string: string = "";
      const img_as_hex: Array<string> = [];
      img.forEach((el, ndx) => {
        hex_string = hex_string + el.toString(16);
        if(ndx % 4 === 3){
          img_as_hex.push(hex_string);
          hex_string = "";
        }

      });


      //the color table is a unique list of all the colors in this image
      const seen: Array<string> = [];
      const color_table: Array<string> = img_as_hex.filter((el, ndx) => {
        if(seen.find(seen => seen === el) === undefined){
          seen.push(el);
          return true;
        }
      });
      console.log("color table", color_table);


      //create a draft for each color table
      color_table.forEach(color => {
        const draft: Draft = new Draft({warps: warps, wefts: wefts});
        console.log(draft);
        img_as_hex.forEach((el, ndx)=>{
          const r: number = Math.floor(ndx/warps);
          const c: number = ndx % warps;
          if(el === color) draft.pattern[r][c].setHeddleUp();
          else draft.pattern[r][c].unsetHeddle();
        });
        drafts.push(draft);
        const loom:Loom = new Loom(draft, 8, 10);
        loom.overloadType('jacquard');
        looms.push(loom);
      })



  
      // for (var i=0; i< e.height; i++) {
      //   pattern.push([]);
      //   for (var j=0; j< e.width; j++) {
      //     var idx = (i * 4 * warps) + (j * 4);
      //     var threshold = (img[idx] + img[idx+1] + img[idx+2]);
      //     var alpha = img[idx + 3];
  
      //     if (threshold < 750 && alpha != 0) {
      //       pattern[i].push(new Cell(true));
      //     } else {
      //       pattern[i].push(new Cell(false));
      //     }
      //   }
      // }
  
      // const draft: Draft = new Draft({warps: warps, wefts: wefts, pattern: pattern});
      // drafts.push(draft);
      
      // //create a blank loom to accompany this
      // const loom:Loom = new Loom(draft, 8, 10);
      // loom.overloadType('jacquard');
      // looms.push(loom);


      const f: FileObj = {
        drafts: drafts,
        looms: looms,
        patterns: [],
        nodes: [], 
        treenodes: [],
        ops: [], 
        notes: ""
      }
  
      return {data: f ,status: 0};  
    },
    bmp: (data: any) : LoadResponse => {

      let drafts: Array<Draft> = [];
      let looms: Array<Loom> = [];

      let e = data;
      const warps = e.width;
      const wefts = e.height;
  
      var img = e.data;
      var pattern = [];
  
      for (var i=0; i< e.height; i++) {
        pattern.push([]);
        for (var j=0; j< e.width; j++) {
          var idx = (i * 4 * warps) + (j * 4);
          var threshold = (img[idx] + img[idx+1] + img[idx+2]);
          var alpha = img[idx + 3];
  
          if (threshold < 750 && alpha != 0) {
            pattern[i].push(new Cell(true));
          } else {
            pattern[i].push(new Cell(false));
          }
        }
      }
  
      const draft: Draft = new Draft({warps: warps, wefts: wefts, pattern: pattern});
      drafts.push(draft);
      
      //create a blank loom to accompany this
      const loom:Loom = new Loom(draft, 8, 10);
      loom.overloadType('jacquard');
      looms.push(loom);


      const f: FileObj = {
        drafts: drafts,
        looms: looms,
        patterns: [],
        nodes: [], 
        treenodes: [],
        ops: [], 
        notes: ""
      }
  
      return {data: f ,status: 0};    
    },
    form: (f:any):LoadResponse =>{

      let drafts: Array<Draft> = [];
      let looms: Array<Loom> = [];
      let patterns: Array<Pattern> = [];
      
      var warps = 20;
      if(f.value.warps !== undefined) warps = f.value.warps;


      var wefts = 20;
      if(f.value.wefts !== undefined) wefts = f.value.wefts;
      //set default values

      const draft: Draft = new Draft({warps: warps, wefts: wefts});
      drafts.push(draft);

      const randomColor = Math.floor(Math.random()*16777215).toString(16);
      let s0 = new Shuttle({id: 0, name: 'Color 1', type: 0,  thickness:50, color: '#333333', visible: true, insert:false, notes: ""});
      let s1 = new Shuttle({id: 1, name: 'Color 2', type: 0, thickness:50, color: '#'+randomColor, visible:true, insert:false, notes: ""});
      let s2 = new Shuttle({id: 2, name: 'Conductive', type: 1, thickness:50, color: '#61c97d', visible:true, insert:false, notes: ""});
      draft.overloadShuttles([s0, s1, s2]);

      var frame_num = (f.value.frame_num === undefined) ? 8 : f.value.frame_num;
      var treadle_num = (f.value.treadle_num === undefined) ? 10 : f.value.treadle_num;
      

      const loom: Loom = new Loom(draft, frame_num, treadle_num);
      looms.push(loom);

      var loomtype = "jacquard";
      if(f.value.loomtype !== undefined || f.value.loomtype) loom.overloadType(f.value.loomtype);
  
  
     // var loomtype = (f.value.loomtype === undefined || !f.value.loomtype) ? "frame" : f.value.loomtype;
      var frame_num = (f.value.frame_num === undefined) ? 2 : f.value.frame_num;
      var treadle_num = (f.value.treadle_num === undefined) ? 2 : f.value.treadle_num;
      
  

      var epi = (f.value.epi === undefined) ? 10 : f.value.epi;
      var units = (f.value.units === undefined || ! f.value.units) ? "in" : f.value.units;
      
      loom.overloadEpi(epi);
      loom.overloadUnits(units);
    
    
      const envt: FileObj = {
        drafts: drafts,
        looms: looms,
        patterns: patterns,
        nodes: [],
        treenodes: [],
        ops: [],
        notes: ""
      }

      return {data: envt, status: 0};
    }
  }

  // interface FileSaver{
  //   ada: (drafts: Array<Draft>, looms: Array<Loom>, pattern: Array<Pattern>, palette:PaletteComponent) => void,
  //   wif: (drafts: Array<Draft>, looms: Array<Loom>) => void,
  //   bmp: (drafts: Array<Draft>) => LoadResponse,
  //   jpg: (drafts: Array<Draft>, looms: Array<Loom>, pattern: Array<Pattern>, palette:PaletteComponent) => void
  // }
  

  const dsaver: FileSaver = {
    ada:  (type: string, drafts: Array<Draft>, looms: Array<Loom>, patterns: Array<Pattern>, notes: string, for_timeline: boolean) : string => {
      //eventually need to add saved patterns here as well
      const out: SaveObj = {
        type: type,
        drafts: drafts,
        looms: looms,
        patterns: patterns,
        nodes: this.tree.exportNodesForSaving(),
        tree: this.tree.exportTreeForSaving(),
        ops: this.tree.exportOpMetaForSaving(),
        notes: notes
      }

      var theJSON = JSON.stringify(out);
      if(for_timeline) return theJSON;

      const href:string = "data:application/json;charset=UTF-8," + encodeURIComponent(theJSON);
      return href;
    },
    wif: (draft: Draft, loom: Loom) : string => {
      const shuttles: Array<Shuttle> = draft.shuttles;
        //will need to import the obj for draft2wif.ts and then use it and pass this.weave for fileContents
      var fileContents = "[WIF]\nVersion=1.1\nDate=November 6, 2020\nDevelopers=Unstable Design Lab at the University of Colorado Boulder\nSource Program=AdaCAD\nSource Version=3.0\n[CONTENTS]";
      var fileType = "text/plain";

      fileContents += "\nCOLOR PALETTE=yes\nWEAVING=yes\nWARP=yes\nWEFT=yes\nTIEUP=yes\nCOLOR TABLE=yes\nTHREADING=yes\nWARP COLORS=yes\nTREADLING=yes\nWEFT COLORS=yes\n";
      
      fileContents += "[COLOR PALETTE]\n";
      fileContents += "Entries=" + (shuttles.length).toString() +"\n";
      fileContents += "Form=RGB\nRange=0,255\n";

      fileContents += "[WEAVING]\nShafts=";
      fileContents += loom.min_frames.toString();
      fileContents += "\nTreadles=";
      fileContents += loom.min_treadles.toString();
      fileContents += "\nRising Shed=yes\n";
      fileContents += "[WARP]\nThreads=";
      fileContents += draft.warps.toString();
      
      var warpColors = [];
      for (var i = 0; i < draft.colShuttleMapping.length; i++) {
        if (!warpColors.includes(draft.colShuttleMapping[i])) {
          warpColors.push(draft.colShuttleMapping[i]);
        }
      }
      fileContents += "\nColors=" + warpColors.length.toString();

      fileContents += "\n[WEFT]\nThreads=";
      fileContents += draft.wefts.toString();
      var weftColors = [];
      for (var i = 0; i < draft.colShuttleMapping.length; i++) {
        if (!weftColors.includes(draft.colShuttleMapping[i])) {
          weftColors.push(draft.colShuttleMapping[i]);
        }
      }
      fileContents += "\nColors=" + weftColors.length.toString();

      fileContents += "\n[TIEUP]\n";

      var treadles = [];
      for (var i =0; i < loom.tieup.length;i++) {
        for (var j = 0; j < loom.tieup[i].length;j++) {
          if (loom.tieup[i][j] && !treadles.includes(j)) {
            treadles.push(j);
          }
        }
      }
      for (var i =0; i < treadles.length; i++) {
        fileContents += (treadles[i]+1).toString() + "=";
        var lineMarked = false;
        for (var j = 0; j < loom.tieup.length; j++){
          if (loom.tieup[j][treadles[i]]) { 
            if (lineMarked) {
              fileContents += ",";
            }
            fileContents += (j+1).toString();
            lineMarked=true;
          }
        }
        fileContents += "\n";
      }

      fileContents+= "[COLOR TABLE]\n";
      //Reference: https://css-tricks.com/converting-color-spaces-in-javascript/ for conversion for hex to RGB
      var counter = 1;
      for (var i = 0; i < shuttles.length; i++) {
        fileContents+= (counter).toString();
        counter = counter + 1;
        fileContents+= "=";
        var hex = shuttles[i].color;
        if (hex.length == 7) {
          var r = "0x" + hex[1] + hex[2];
          var g = "0x" + hex[3] + hex[4];
          var b = "0x" + hex[5] + hex[6];

          fileContents += (+r).toString() + "," + (+g).toString() + "," + (+b).toString() + "\n";
        }
      }
      
      fileContents += "[THREADING]\n";
      for (var i=0; i <loom.threading.length; i++) {
        var frame = loom.threading[i];
        if (frame != -1) {
          fileContents += (loom.threading.length-i).toString() + "=" + (frame+1).toString() + "\n";
        }
      }

      fileContents += "[WARP COLORS]\n";
      for (var i = 0; i < draft.colShuttleMapping.length; i++) {
        fileContents += (i+1).toString() + "=" + (draft.colShuttleMapping[(draft.colShuttleMapping.length)-(i+1)]+1).toString() + "\n";
      }

      fileContents += "[TREADLING]\n";
      for (var i = 0; i < loom.treadling.length; i++) {
        if (loom.treadling[i] != null && loom.treadling[i] != -1){
          fileContents += (i+1).toString() + "=" + (loom.treadling[i]+1).toString() + "\n";
        }
      }

      fileContents += "[WEFT COLORS]\n";
      for (var i = 0; i < draft.rowShuttleMapping.length; i++) { // will likely have to change the way I import too
        fileContents += (i+1).toString() + "=" + (draft.rowShuttleMapping[i]+1).toString() + "\n";
      }

      const href:string = "data:" + fileType +";base64," + btoa(fileContents);
      return href;
    },
    bmp: (canvas:HTMLCanvasElement) : string => {
      return canvas.toDataURL("image/jpg");

    },
    jpg: (canvas:HTMLCanvasElement) : string => {
      return canvas.toDataURL("image/jpg");
    }
  }


  this.loader = dloader;
  this.saver = dsaver;

  }




}
