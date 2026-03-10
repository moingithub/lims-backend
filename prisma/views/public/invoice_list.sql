SELECT
  ih.id,
  ih.invoice_date,
  comp.name AS company_name,
  ih.invoice_number,
  ih.total_amount AS amount,
  ih.payment_status
FROM
  (
    invoice_headers ih
    LEFT JOIN companies comp ON ((ih.company_id = comp.id))
  );