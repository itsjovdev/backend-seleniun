import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity()
export class InvoiceCounter {
  @PrimaryColumn()
  id: number;

  @Column()
  value: number;
}
