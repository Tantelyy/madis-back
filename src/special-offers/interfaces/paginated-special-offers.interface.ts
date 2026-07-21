import { SpecialOfferEntity } from '../entities/special-offer.entity';

export interface PaginatedSpecialOffers {
  data: SpecialOfferEntity[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
