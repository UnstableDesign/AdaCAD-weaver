/**
 * Definition of Data object.
 * @class
 */
export class Attribute {
  //TODO: define class
  color: string;
  id: number;
  name: string;
  
  insert: number;

  constructor() {
    this.insert = 0;
  }

  setID(id: number) {
    this.id = id;
    if (!this.name) {
      this.name = 'Attribute' + (id + 1);
    }
  }

  setColor(color: string) {
    this.color = color;
  }

  getColor() {
    return this.color;
  }
}