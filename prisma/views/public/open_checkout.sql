SELECT
  cylinder_checkout.id,
  companies.name AS company_name,
  cylinders.cylinder_type,
  cylinders.cylinder_number,
  company_contacts.name AS contact_name,
  company_contacts.phone,
  company_contacts.email,
  cylinder_checkout.created_at AS checkout_date
FROM
  (
    (
      (
        cylinder_checkout
        LEFT JOIN cylinders ON ((cylinder_checkout.cylinder_id = cylinders.id))
      )
      LEFT JOIN companies ON ((cylinder_checkout.company_id = companies.id))
    )
    LEFT JOIN company_contacts ON (
      (
        cylinder_checkout.company_contact_id = company_contacts.id
      )
    )
  )
WHERE
  (cylinder_checkout.is_returned = false);