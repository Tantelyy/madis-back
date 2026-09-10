UPDATE "Products" AS product
SET "name" = CONCAT_WS(
  ' ',
  NULLIF(TRIM(product_type."type"), ''),
  NULLIF(TRIM(specification."specification"), ''),
  NULLIF(TRIM(mark."name"), ''),
  NULLIF(TRIM(product_format."format"), '')
)
FROM "ProductTypes" AS product_type,
     "ProductSpecifications" AS specification,
     "ProductMarks" AS mark,
     "ProductFormats" AS product_format
WHERE product."productTypeId" = product_type."ID"
  AND product."specificationId" = specification."ID"
  AND product."markId" = mark."ID"
  AND product."formatId" = product_format."ID";
