# User Interface Wireframes

## Landing

```text
OWBRHE
Care Study Submission                                      Author
                                                           KYEREMEH


                         [ Student ]    [ Academic ]


© 2026 Evans Kwadwo Kyeremeh. +233 249 305 925. All rights reserved.
```

## Student

```text
Header: OWBRHE / Care Study Submission

[Register] [Login]

Register: Full name | Index number | Password
Login:    Index number | Password

After login:
Supervisor: readonly supervisor full name
Date and time: datetime input
PDF: upload input, disabled after submission unless admin allows resubmission
[Submit care study]

Submitted state: file name, submission time, no student open/download action unless admin enables file viewing.
```

## Academic Supervisor

```text
[Supervisor Register] [Supervisor Login] [Super Admin Login]

Supervisor dashboard:
Pending students: name, index number, accept/reject
Assigned students: name, index, status, submitted file, view PDF, download PDF
[Export Excel]
```

## Super Administrator

```text
Dashboard tabs:
Users | Settings | Files | Activity Log

Users:
pending students/supervisors, accept/reject, edit name/index/password, allow resubmission

Settings:
opening date/time, closing date/time, allow student file view, global resubmission

Files:
student, index number, supervisor, submission time, attached PDF, view/download

Activity Log:
user type, name, ID/index number, login date, time in, time out, device used, IP address, action, outcome
```
