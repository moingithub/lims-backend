SELECT
  cc.id,
  comp.name AS company_name,
  cyl.cylinder_type,
  cyl.cylinder_number,
  contact.name AS contact_name,
  contact.phone,
  contact.email,
  cc.created_at AS checkout_date
FROM
  (
    (
      (
        cylinder_checkout cc
        LEFT JOIN cylinders cyl ON ((cc.cylinder_id = cyl.id))
      )
      LEFT JOIN companies comp ON ((cc.company_id = comp.id))
    )
    LEFT JOIN company_contacts contact ON ((cc.company_contact_id = contact.id))
  )
WHERE
  (cc.is_returned = false);