import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Warehouse } from './entities/warehouse.entity';
import {
  PaginationDto,
  createPaginatedResult,
  getPaginationOptions,
} from '../common/pagination';

import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { evaluateCapacity, loadWarehouse } from './warehouse-capacity';

@Injectable()
export class WarehousesService {
  constructor(
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>,
  ) {}

  /**
   * How full a warehouse gets if [quantity] more units go in right now
   * (Stock In, Transfer, Adjustment increase). Units still on order are not
   * counted: only what is in stock plus these units.
   */
  async capacityCheck(warehouseCode: string, quantity: number) {
    const warehouse = await this.warehouseRepository.findOne({
      where: { code: warehouseCode.trim().toUpperCase(), isActive: true },
    });
    if (!warehouse) {
      throw new NotFoundException(`Warehouse "${warehouseCode}" not found`);
    }
    const load = await loadWarehouse(this.warehouseRepository.manager, warehouse.id);
    const qty = Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
    return {
      warehouse: { code: warehouse.code, name: warehouse.name },
      ...evaluateCapacity({ ...load!, incoming: 0 }, Math.round(qty * 1000) / 1000),
    };
  }

  // CREATE
  async create(dto: CreateWarehouseDto) {
    const existing = await this.warehouseRepository.findOne({
      where: { code: dto.code.toUpperCase() },
    });

    if (existing) {
      throw new ConflictException('Warehouse code already exists');
    }

    const warehouse = this.warehouseRepository.create({
      ...dto,
      code: dto.code.toUpperCase(),
      name: dto.name.trim(),
    });

    return this.warehouseRepository.save(warehouse);
  }

  // FIND ALL
  async findAll(paginationDto?: PaginationDto) {
    const { limit, skip } = getPaginationOptions(paginationDto);
    const search = paginationDto?.search?.trim();

    const queryBuilder = this.warehouseRepository
      .createQueryBuilder('warehouse')
      .where('warehouse.isActive = :isActive', { isActive: true });

    if (search) {
      queryBuilder.andWhere(
        '(warehouse.name ILIKE :search OR warehouse.code ILIKE :search OR warehouse.address ILIKE :search OR warehouse.contactPerson ILIKE :search OR warehouse.phone ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    queryBuilder.orderBy('warehouse.name', 'ASC');
    queryBuilder.skip(skip).take(limit);

    const [warehouses, total] = await queryBuilder.getManyAndCount();

    return createPaginatedResult(
      await this.withUsage(warehouses),
      total,
      paginationDto,
    );
  }

  // FIND ONE
  async findOne(id: string) {
    const warehouse = await this.warehouseRepository.findOne({
      where: { id },
    });

    if (!warehouse) {
      throw new NotFoundException('Warehouse not found');
    }

    return warehouse;
  }

  /** One warehouse with its limit and how much of it is used. */
  async detail(id: string) {
    const warehouse = await this.findOne(id);
    return (await this.withUsage([warehouse]))[0];
  }

  /**
   * Adds the stock in each warehouse (`usedQuantity`) and what is still to
   * arrive on open purchase orders (`incomingQuantity`), next to `capacity`.
   */
  private async withUsage(list: Warehouse[]) {
    if (list.length === 0) return [];
    const ids = list.map((w) => w.id);

    const stockRows: Array<{ id: string; used: string }> =
      await this.warehouseRepository.query(
        `SELECT s.warehouse_id AS id, SUM(s.quantity) AS used
           FROM stocks s
          WHERE s.warehouse_id = ANY($1::uuid[])
          GROUP BY s.warehouse_id`,
        [ids],
      );
    const incomingRows: Array<{ id: string; incoming: string }> =
      await this.warehouseRepository.query(
        `SELECT p.warehouse_id AS id,
                SUM(GREATEST(i.quantity - i.received_quantity, 0)) AS incoming
           FROM purchase_order_items i
           JOIN purchase_orders p ON p.id = i.purchase_order_id
          WHERE p.warehouse_id = ANY($1::uuid[])
            AND p.status IN ('SUBMITTED', 'APPROVED', 'PARTIALLY_RECEIVED')
          GROUP BY p.warehouse_id`,
        [ids],
      );
    const used = new Map(stockRows.map((r) => [r.id, Number(r.used)]));
    const incoming = new Map(
      incomingRows.map((r) => [r.id, Number(r.incoming)]),
    );

    return list.map((w) => ({
      ...w,
      capacity: w.capacity === null ? null : Number(w.capacity),
      usedQuantity: used.get(w.id) ?? 0,
      incomingQuantity: incoming.get(w.id) ?? 0,
    }));
  }

  // UPDATE
  async update(id: string, dto: UpdateWarehouseDto) {
    const warehouse = await this.findOne(id);

    if (dto.code) {
      const code = dto.code.toUpperCase();

      const existing = await this.warehouseRepository.findOne({
        where: { code },
      });

      if (existing && existing.id !== id) {
        throw new ConflictException('Warehouse code already exists');
      }

      dto.code = code;
    }

    if (dto.name) {
      const name = dto.name.trim();

      const existing = await this.warehouseRepository.findOne({
        where: { name },
      });

      if (existing && existing.id !== id) {
        throw new ConflictException('Warehouse name already exists');
      }

      dto.name = name;
    }

    // A new limit cannot be lower than what the warehouse already holds.
    if (dto.capacity !== undefined && dto.capacity !== null) {
      const [row]: Array<{ used: string }> =
        await this.warehouseRepository.query(
          `SELECT COALESCE(SUM(quantity), 0) AS used
             FROM stocks WHERE warehouse_id = $1`,
          [id],
        );
      const used = Number(row?.used ?? 0);
      if (dto.capacity < used) {
        throw new BadRequestException(
          `Capacity cannot be lower than the ${used} units already in this warehouse`,
        );
      }
    }

    Object.assign(warehouse, dto);

    return this.warehouseRepository.save(warehouse);
  }

  // DEACTIVATE
  async deactivate(id: string) {
    const warehouse = await this.findOne(id);

    if (!warehouse.isActive) {
      return {
        message: 'Warehouse is already inactive',
      };
    }

    warehouse.isActive = false;

    await this.warehouseRepository.save(warehouse);

    return {
      message: 'Warehouse deactivated successfully',
    };
  }

  // ACTIVATE
  async activate(id: string) {
    const warehouse = await this.findOne(id);

    if (warehouse.isActive) {
      return {
        message: 'Warehouse is already active',
      };
    }

    warehouse.isActive = true;

    await this.warehouseRepository.save(warehouse);

    return {
      message: 'Warehouse activated successfully',
    };
  }
}
