import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class Invoice {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  number: string;

  @Column({ default: '' })
  buyer: string;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  total: number;

  @Column()
  date: Date;
}
