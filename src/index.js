const { Pool } = require('pg');
const express = require('express');


const app = express();
app.use(express.json()); // Add this line

// Database connection
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'lessons',
  password: '51kln00bfd54FTY',
  port: 5432,
});

// API endpoint
app.post('/api/lessons', async (req, res) => {
  const { date, status, teacherIds, studentsCount, page, lessonsPerPage } = req.body;

  // let query = `
  // SELECT 
  //   l.id, 
  //   l.date, 
  //   l.title, 
  //   l.status,
  //   CAST((SELECT COUNT(*) FROM lesson_students ls WHERE ls.lesson_id = l.id AND ls.visit = TRUE) AS INTEGER) AS visitCount, 
  //   (SELECT JSON_AGG(JSON_BUILD_OBJECT('id', s.id, 'name', s.name, 'visit', ls.visit)) AS students
  //   FROM lesson_students ls
  //   JOIN students s ON ls.student_id = s.id
  //   WHERE ls.lesson_id = l.id) AS students,
  //   (SELECT JSON_AGG(JSON_BUILD_OBJECT('id', t.id, 'name', t.name)) AS teachers
  //   FROM lesson_teachers lt
  //   JOIN teachers t ON lt.teacher_id = t.id
  //   WHERE lt.lesson_id = l.id) AS teachers
  // FROM 
  //   lessons l
  // `;
  let query = `
    WITH lesson_visit_counts AS (
      SELECT 
        l.id,
        (SELECT CAST(COUNT(*) AS INTEGER) FROM lesson_students ls WHERE ls.lesson_id = l.id AND ls.visit = TRUE) AS visitCount
      FROM 
        lessons l
    )
    SELECT 
      l.id,
      l.date,
      l.title,
      l.status,
      lvc.visitCount,
      json_agg(json_build_object(
        'id', s.id,
        'name', s.name,
        'visit', ls.visit
      )) AS students,
      json_agg(json_build_object(
        'id', t.id,
        'name', t.name
      )) AS teachers
    FROM 
      lessons l
    JOIN lesson_visit_counts lvc ON l.id = lvc.id
    LEFT JOIN lesson_students ls ON l.id = ls.lesson_id
    LEFT JOIN students s ON ls.student_id = s.id
    LEFT JOIN lesson_teachers lt ON l.id = lt.lesson_id
    LEFT JOIN teachers t ON lt.teacher_id = t.id
  `;

  let whereClause = [];

  if (date) {
    const dates = date.split(',');
    if (dates.length === 1) {
      whereClause.push(`l.date = '${dates[0]}'`);
    } else {
      whereClause.push(`l.date BETWEEN '${dates[0]}' AND '${dates[1]}'`);
    }
  }

  if (typeof status === 'number') {
    whereClause.push(`l.status = ${status}`);
  }

  if (teacherIds) {
    // const teacherIdsArray = teacherIds.split(',');
    // whereClause.push(`t.id IN (${teacherIdsArray.map(id => `'${id}'`).join(', ')})`);
    whereClause.push(`t.id IN (${teacherIds})`);
  }

  if (studentsCount) {
    const studentsCountArray = studentsCount.split(',');
    if (studentsCountArray.length === 1) {
      whereClause.push(`lvc.visitCount = ${studentsCountArray[0]}`);
    } else {
      whereClause.push(`lvc.visitCount BETWEEN ${studentsCountArray[0]} AND ${studentsCountArray[1]}`);
    }
  }

  if (whereClause.length > 0) {
    query += ` WHERE ${whereClause.join(' AND ')}`;
  }

  query += ` GROUP BY l.id, l.date, l.title, l.status, lvc.visitCount`;

  const elementsPerPage = lessonsPerPage || 5
  const truePage = page || 0
  const offset = ((page || 1) - 1) * elementsPerPage;
  // console.log(((page || 1) - 1) * lessonsPerPage)
  query += ` LIMIT ${elementsPerPage} OFFSET ${offset}`;


  console.log(query)

  try {
    const result = await pool.query(query);

    for (const row of result.rows) {
      row.students = Array.from(new Map(row.students.map(item => [item.id, item])).values());
      row.teachers = Array.from(new Map(row.teachers.map(item => [item.id, item])).values());
    }

    const pagination = {
      page: truePage,
      lessonsPerPage: elementsPerPage
    };
    
    res.json({ rows: result.rows, pagination });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Invalid request' });
  }
});

app.listen(3000, () => {
  console.log('Server listening on port 3000');
});