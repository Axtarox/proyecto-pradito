/**
 * Controlador para el panel de administración 
 */
const Producto = require('../models/Producto');
const Categoria = require('../models/Categoria');
const Servicio = require('../models/Servicio');
const path = require('path');
const fs = require('fs');
const { formatPrice } = require('../helpers/formatHelper');

/**
 * Muestra el dashboard principal
 */
exports.getDashboard = async (req, res) => {
  try {
    // Obtener estadísticas básicas
    const allProductos = await Producto.getAll();
    const availableProductos = await Producto.getAllAvailable();
    const numCategorias = (await Categoria.getAll()).length;
    
    // Para servicios, usar getAllForAdmin para contar todos los servicios
    const allServicios = await Servicio.getAllForAdmin();
    const availableServicios = await Servicio.getAll(); 
    
    // Renderizar dashboard en modo standalone
    res.render('admin/dashboard', {
      titulo: 'Dashboard - Panel de Administración',
      admin: req.session.adminData,
      stats: {
        productos: allProductos.length,
        productosDisponibles: availableProductos.length,
        categorias: numCategorias,
        servicios: allServicios.length,
        serviciosDisponibles: availableServicios.length
      },
      current_page: { dashboard: true },
      standalone: true 
    });
  } catch (error) {
    console.error('Error al cargar dashboard:', error);
    res.status(500).render('error', {
      titulo: 'Error',
      mensaje: 'Error al cargar el dashboard',
      error: process.env.NODE_ENV === 'development' ? error.message : null
    });
  }
};

/**
 * Gestión de productos 
 */
exports.getProductos = async (req, res) => {
  try {
    // Obtener TODOS los productos para el admin 
    const productos = await Producto.getAll();
    
    // Formatear precios y asegurar tipos correctos para visualización
    const productosFormateados = productos.map(producto => {
      // Convertir el campo disponible a booleano de forma más robusta
      let disponible = false;
      
      // Manejar diferentes tipos de valores de disponible
      if (producto.disponible === 1 || 
          producto.disponible === '1' || 
          producto.disponible === true || 
          producto.disponible === 'true') {
        disponible = true;
      }
      
      return {
        ...producto,
        precio: formatPrice(producto.precio),
        disponible: disponible  // Asegurar que sea booleano
      };
    });
    
    // Obtener categorías para el formulario
    const categorias = await Categoria.getAll();
    
    res.render('admin/productos', {
      titulo: 'Gestión de Productos',
      admin: req.session.adminData,
      productos: productosFormateados,
      categorias,
      current_page: { productos: true },
      standalone: true 
    });
  } catch (error) {
    console.error('Error al obtener productos:', error);
    res.status(500).render('error', {
      titulo: 'Error',
      mensaje: 'Error al cargar los productos',
      error: process.env.NODE_ENV === 'development' ? error.message : null
    });
  }
};

/**
 * Muestra la página para crear un nuevo producto
 */
exports.getCrearProductoForm = async (req, res) => {
  try {
    // Obtener categorías para el formulario
    const categorias = await Categoria.getAll();
    
    res.render('admin/producto-crear', {
      titulo: 'Crear Nuevo Producto',
      admin: req.session.adminData,
      categorias,
      current_page: { productos: true },
      standalone: true
    });
  } catch (error) {
    console.error('Error al cargar formulario de creación:', error);
    res.status(500).render('error', {
      titulo: 'Error',
      mensaje: 'Error al cargar el formulario',
      error: process.env.NODE_ENV === 'development' ? error.message : null
    });
  }
};

/**
 * Crea un nuevo producto 
 */
exports.crearProducto = async (req, res) => {
  try {
    // Obtener datos del formulario
    const { 
      nombre, 
      categoria_id, 
      precio, 
      condicion, 
      descripcion, 
      caracteristicas,
      cantidad_disponible,
      disponible 
    } = req.body;
    
    // Verificar campos requeridos 
    if (!nombre || !categoria_id || !precio || !condicion || !descripcion || !caracteristicas) {
      // Obtener categorías para el formulario
      const categorias = await Categoria.getAll();
      
      // Determinar qué campos específicos faltan
      let errorMessage = 'Por favor complete todos los campos obligatorios:';
      const missingFields = [];
      
      if (!nombre) missingFields.push('Nombre del producto');
      if (!categoria_id) missingFields.push('Categoría');
      if (!precio) missingFields.push('Precio');
      if (!condicion) missingFields.push('Condición');
      if (!descripcion) missingFields.push('Descripción');
      if (!caracteristicas) missingFields.push('Características');
      
      if (missingFields.length > 0) {
        errorMessage += ' ' + missingFields.join(', ');
      }
      
      return res.render('admin/producto-crear', {
        titulo: 'Crear Nuevo Producto',
        admin: req.session.adminData,
        categorias,
        error: errorMessage,
        current_page: { productos: true },
        standalone: true
      });
    }
    
    // Validar que la condición sea válida
    const condicionesValidas = ['Nuevo', 'Usado', 'Reacondicionado', 'Digital'];
    if (!condicionesValidas.includes(condicion)) {
      const categorias = await Categoria.getAll();
      
      return res.render('admin/producto-crear', {
        titulo: 'Crear Nuevo Producto',
        admin: req.session.adminData,
        categorias,
        error: 'La condición seleccionada no es válida. Por favor seleccione una opción del menú.',
        current_page: { productos: true },
        standalone: true
      });
    }
    
    // Procesar imagen si se ha subido
    let imagenUrl = '/img/default-product.jpg'; // Imagen por defecto
    
    if (req.file) {
      // Si existe una carpeta para subir imágenes, usar esa ruta
      const uploadsDir = path.join(__dirname, '../../public/uploads');
      
      // Crear directorio si no existe
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      
      // URL relativa para la base de datos
      imagenUrl = `/uploads/${req.file.filename}`;
    }
    
    // Convertir el precio a número limpiando separadores
    const precioNumerico = parseFloat(String(precio).replace(/\./g, '').replace(/,/g, '.')) || 0;
    
    // Validar que el precio sea válido
    if (precioNumerico <= 0) {
      const categorias = await Categoria.getAll();
      
      return res.render('admin/producto-crear', {
        titulo: 'Crear Nuevo Producto',
        admin: req.session.adminData,
        categorias,
        error: 'El precio debe ser mayor que cero.',
        current_page: { productos: true },
        standalone: true
      });
    }
    
    // Procesar disponibilidad correctamente
    let isDisponible = false;
    if (disponible === 'on' || disponible === true || disponible === 'true' || disponible === '1') {
      isDisponible = true;
    }
    
    // Validar y procesar características
    const caracteristicasLimpias = caracteristicas.trim();
    if (caracteristicasLimpias.length < 1) {
      const categorias = await Categoria.getAll();
      
      return res.render('admin/producto-crear', {
        titulo: 'Crear Nuevo Producto',
        admin: req.session.adminData,
        categorias,
        error: 'Las características deben tener al menos 1 caracter.',
        current_page: { productos: true },
        standalone: true
      });
    }
    
    // Crear objeto de producto
    const productoData = {
      nombre,
      categoria_id: parseInt(categoria_id),
      precio: precioNumerico,
      condicion,
      descripcion,
      caracteristicas: caracteristicasLimpias,
      cantidad_disponible: parseInt(cantidad_disponible) || 0,
      disponible: isDisponible,
      imagen: imagenUrl
    };
    
    // Guardar producto en la base de datos
    const productoId = await Producto.create(productoData);
    
    if (!productoId) {
      throw new Error('No se pudo crear el producto');
    }
    
    // Mensaje de éxito con información sobre visibilidad
    const visibilityMessage = isDisponible ? 
      'Producto creado correctamente y visible en la tienda.' : 
      'Producto creado correctamente pero oculto en la tienda (puedes activarlo editándolo).';
    
    // Redirigir a la lista de productos con mensaje de éxito
    req.session.successMessage = visibilityMessage;
    res.redirect('/admin/productos');
  } catch (error) {
    console.error('Error al crear producto:', error);
    
    // Obtener categorías para mostrar el formulario nuevamente
    const categorias = await Categoria.getAll();
    
    res.render('admin/producto-crear', {
      titulo: 'Crear Nuevo Producto',
      admin: req.session.adminData,
      categorias,
      error: `Error al crear el producto: ${error.message}`,
      current_page: { productos: true },
      standalone: true
    });
  }
};

/**
 * Muestra un producto específico
 */
exports.getProductoById = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).render('error', {
        titulo: 'Error',
        mensaje: 'ID de producto inválido'
      });
    }
    
    // Obtener producto 
    const producto = await Producto.getById(id);
    
    if (!producto) {
      return res.status(404).render('error', {
        titulo: 'Error',
        mensaje: 'Producto no encontrado'
      });
    }
    
    // Procesar características
    let caracteristicasList = [];
    if (producto.caracteristicas) {
      caracteristicasList = producto.caracteristicas
        .split(/\n|\r|\r\n|-|•|\\n/)
        .map(item => item.trim())
        .filter(item => item.length > 0);
    }
    
    // Formatear el precio para visualización
    producto.precio = formatPrice(producto.precio);
    
    res.render('admin/producto-detalle', {
      titulo: `Producto: ${producto.nombre}`,
      admin: req.session.adminData,
      producto,
      caracteristicasList,
      current_page: { productos: true },
      standalone: true
    });
  } catch (error) {
    console.error('Error al obtener producto:', error);
    res.status(500).render('error', {
      titulo: 'Error',
      mensaje: 'Error al cargar el producto',
      error: process.env.NODE_ENV === 'development' ? error.message : null
    });
  }
};

/**
 * Muestra el formulario para editar un producto
 */
exports.getEditarProductoForm = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).render('error', {
        titulo: 'Error',
        mensaje: 'ID de producto inválido'
      });
    }
    
    // Obtener producto y categorías en paralelo para optimizar
    const [producto, categorias] = await Promise.all([
      Producto.getById(id),
      Categoria.getAll()
    ]);
    
    if (!producto) {
      return res.status(404).render('error', {
        titulo: 'Error',
        mensaje: 'Producto no encontrado'
      });
    }
    
    // Formatear el precio para visualización
    producto.precio = formatPrice(producto.precio);
    
    // Asegurar que disponible sea un booleano
    producto.disponible = Boolean(producto.disponible);
    
    // Renderizar la vista con los datos completos
    res.render('admin/producto-editar', {
      titulo: 'Editar Producto',
      admin: req.session.adminData,
      producto,
      categorias,
      current_page: { productos: true },
      standalone: true
    });
  } catch (error) {
    console.error('Error al cargar formulario de edición:', error);
    res.status(500).render('error', {
      titulo: 'Error',
      mensaje: 'Error al cargar el formulario de edición',
      error: process.env.NODE_ENV === 'development' ? error.message : null
    });
  }
};


/**
 * Actualiza un producto existente 
 */
exports.editarProducto = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).render('error', {
        titulo: 'Error',
        mensaje: 'ID de producto inválido'
      });
    }
    
    // Obtener producto actual para usar su imagen si no se sube una nueva
    const productoActual = await Producto.getById(id);
    
    if (!productoActual) {
      return res.status(404).render('error', {
        titulo: 'Error',
        mensaje: 'Producto no encontrado'
      });
    }
    
    // Obtener datos del formulario
    const { 
      nombre, 
      categoria_id, 
      precio, 
      condicion, 
      descripcion, 
      caracteristicas,
      cantidad_disponible,
      disponible 
    } = req.body;
    
    // Verificar campos requeridos 
    if (!nombre || !categoria_id || !precio || !condicion || !descripcion || !caracteristicas) {
      // Obtener categorías para el formulario
      const categorias = await Categoria.getAll();
      
      // Determinar qué campos específicos faltan
      let errorMessage = 'Por favor complete todos los campos obligatorios:';
      const missingFields = [];
      
      if (!nombre) missingFields.push('Nombre del producto');
      if (!categoria_id) missingFields.push('Categoría');
      if (!precio) missingFields.push('Precio');
      if (!condicion) missingFields.push('Condición');
      if (!descripcion) missingFields.push('Descripción');
      if (!caracteristicas) missingFields.push('Características');
      
      if (missingFields.length > 0) {
        errorMessage += ' ' + missingFields.join(', ');
      }
      
      return res.render('admin/producto-editar', {
        titulo: 'Editar Producto',
        admin: req.session.adminData,
        producto: productoActual,
        categorias,
        error: errorMessage,
        current_page: { productos: true },
        standalone: true
      });
    }
    
    // Validar que la condición sea válida
    const condicionesValidas = ['Nuevo', 'Usado', 'Reacondicionado', 'Digital'];
    if (!condicionesValidas.includes(condicion)) {
      const categorias = await Categoria.getAll();
      
      return res.render('admin/producto-editar', {
        titulo: 'Editar Producto',
        admin: req.session.adminData,
        producto: productoActual,
        categorias,
        error: 'La condición seleccionada no es válida. Por favor seleccione una opción del menú.',
        current_page: { productos: true },
        standalone: true
      });
    }
    
    // Procesar imagen si se ha subido una nueva
    let imagenUrl = productoActual.imagen; // Mantener imagen actual por defecto
    
    if (req.file) {
      // Si existe una carpeta para subir imágenes, usar esa ruta
      const uploadsDir = path.join(__dirname, '../../public/uploads');
      
      // Crear directorio si no existe
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      
      // URL relativa para la base de datos
      imagenUrl = `/uploads/${req.file.filename}`;
      
      // Eliminar imagen anterior si no es la predeterminada
      if (productoActual.imagen && !productoActual.imagen.includes('default-product.jpg')) {
        try {
          const imagePath = path.join(__dirname, '../../public', productoActual.imagen);
          if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
          }
        } catch (err) {
          console.error('Error al eliminar imagen anterior:', err);
        }
      }
    }
    
    // Convertir precio formateado a número
    const precioNumerico = parseFloat(String(precio).replace(/\./g, '').replace(/,/g, '.')) || 0;
    
    // Validar que el precio sea válido
    if (precioNumerico <= 0) {
      const categorias = await Categoria.getAll();
      
      return res.render('admin/producto-editar', {
        titulo: 'Editar Producto',
        admin: req.session.adminData,
        producto: productoActual,
        categorias,
        error: 'El precio debe ser mayor que cero.',
        current_page: { productos: true },
        standalone: true
      });
    }
    
    // Procesar disponibilidad correctamente
    let isDisponible = false;
    if (disponible === 'on' || disponible === true || disponible === 'true' || disponible === '1') {
      isDisponible = true;
    }
    
    // Validar y procesar características
    const caracteristicasLimpias = caracteristicas.trim();
    if (caracteristicasLimpias.length < 1) {
      const categorias = await Categoria.getAll();
      
      return res.render('admin/producto-editar', {
        titulo: 'Editar Producto',
        admin: req.session.adminData,
        producto: productoActual,
        categorias,
        error: 'Las características deben tener al menos 1 caracter',
        current_page: { productos: true },
        standalone: true
      });
    }
    
    // Crear objeto de producto actualizado
    const productoData = {
      nombre,
      categoria_id: parseInt(categoria_id),
      precio: precioNumerico,
      condicion,
      descripcion,
      caracteristicas: caracteristicasLimpias,
      cantidad_disponible: parseInt(cantidad_disponible) || 0,
      disponible: isDisponible,
      imagen: imagenUrl
    };
    
    // Actualizar producto en la base de datos
    const success = await Producto.update(id, productoData);
    
    if (!success) {
      throw new Error('No se pudo actualizar el producto');
    }
    
    // Mensaje de éxito con información sobre visibilidad
    const wasAvailable = Boolean(productoActual.disponible);
    let visibilityMessage = 'Producto actualizado correctamente.';
    
    if (wasAvailable && !isDisponible) {
      visibilityMessage += ' El producto ahora está oculto en la tienda.';
    } else if (!wasAvailable && isDisponible) {
      visibilityMessage += ' El producto ahora es visible en la tienda.';
    } else if (isDisponible) {
      visibilityMessage += ' El producto sigue siendo visible en la tienda.';
    } else {
      visibilityMessage += ' El producto sigue oculto en la tienda.';
    }
    
    // Redirigir a la lista de productos con mensaje de éxito
    req.session.successMessage = visibilityMessage;
    res.redirect('/admin/productos');
  } catch (error) {
    console.error('Error al actualizar producto:', error);
    
    // Obtener categorías y producto actual para mostrar el formulario nuevamente
    const [productoActual, categorias] = await Promise.all([
      Producto.getById(parseInt(req.params.id)),
      Categoria.getAll()
    ]);
    
    res.render('admin/producto-editar', {
      titulo: 'Editar Producto',
      admin: req.session.adminData,
      producto: productoActual,
      categorias,
      error: `Error al actualizar el producto: ${error.message}`,
      current_page: { productos: true },
      standalone: true
    });
  }
};
/**
 * Elimina un producto
 */
exports.eliminarProducto = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).render('error', {
        titulo: 'Error',
        mensaje: 'ID de producto inválido'
      });
    }
    
    // Obtener producto para eliminar su imagen
    const producto = await Producto.getById(id);
    
    if (!producto) {
      return res.status(404).render('error', {
        titulo: 'Error',
        mensaje: 'Producto no encontrado'
      });
    }
    
    // Eliminar imagen si no es la predeterminada
    if (producto.imagen && !producto.imagen.includes('default-product.jpg')) {
      try {
        const imgPath = path.join(__dirname, '../../public', producto.imagen);
        if (fs.existsSync(imgPath)) {
          fs.unlinkSync(imgPath);
        }
      } catch (err) {
        console.error('Error al eliminar imagen:', err);
      }
    }
    
    // Eliminar producto de la base de datos
    const success = await Producto.delete(id);
    
    if (!success) {
      throw new Error('No se pudo eliminar el producto');
    }
    
    // Guardar mensaje de éxito en la sesión
    req.session.successMessage = `El producto "${producto.nombre}" ha sido eliminado correctamente`;
    
    // Redirigir a la lista de productos
    return res.redirect('/admin/productos');
  } catch (error) {
    console.error('Error al eliminar producto:', error);
    req.session.error = `Error al eliminar el producto: ${error.message}`;
    return res.redirect('/admin/productos');
  }
};

/**
 * Gestión de categorías
 */
exports.getCategorias = async (req, res) => {
  try {
    // Obtener todas las categorías
    const categorias = await Categoria.getAll();
    
    res.render('admin/categorias', {
      titulo: 'Gestión de Categorías',
      admin: req.session.adminData,
      categorias,
      current_page: { categorias: true },
      standalone: true 
    });
  } catch (error) {
    console.error('Error al obtener categorías:', error);
    res.status(500).render('error', {
      titulo: 'Error',
      mensaje: 'Error al cargar las categorías',
      error: process.env.NODE_ENV === 'development' ? error.message : null
    });
  }
};

/**
 * Gestión de servicios
 */
exports.getServicios = async (req, res) => {
  try {
    // Obtener TODOS los servicios para el admin 
    const servicios = await Servicio.getAllForAdmin();
    
    // Formatear disponibilidad para asegurar consistencia
    const serviciosFormateados = servicios.map(servicio => {
      // Convertir el campo disponible a booleano de forma robusta
      let disponible = false;
      
      // Manejar diferentes tipos de valores de disponible
      if (servicio.disponible === 1 || 
          servicio.disponible === '1' || 
          servicio.disponible === true || 
          servicio.disponible === 'true') {
        disponible = true;
      }
      
      return {
        ...servicio,
        disponible: disponible  
      };
    });
    
    res.render('admin/servicios', {
      titulo: 'Gestión de Servicios',
      admin: req.session.adminData,
      servicios: serviciosFormateados,
      current_page: { servicios: true },
      standalone: true 
    });
  } catch (error) {
    console.error('Error al obtener servicios:', error);
    res.status(500).render('error', {
      titulo: 'Error',
      mensaje: 'Error al cargar los servicios',
      error: process.env.NODE_ENV === 'development' ? error.message : null
    });
  }
};

exports.updateProductDisponibilidad = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { disponible } = req.body;
    
    // Validar ID
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID de producto inválido'
      });
    }
    
    // Obtener producto actual
    const productoActual = await Producto.getById(id);
    
    if (!productoActual) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
    }
    
    // Procesar disponibilidad
    const isDisponible = Boolean(disponible);
    
    // Crear objeto con todos los datos del producto pero solo cambiar disponibilidad
    const productoData = {
      nombre: productoActual.nombre,
      categoria_id: productoActual.categoria_id,
      precio: productoActual.precio,
      condicion: productoActual.condicion,
      descripcion: productoActual.descripcion,
      caracteristicas: productoActual.caracteristicas,
      cantidad_disponible: productoActual.cantidad_disponible,
      disponible: isDisponible,
      imagen: productoActual.imagen
    };
    
    // Actualizar producto usando el modelo
    const success = await Producto.update(id, productoData);
    
    if (!success) {
      throw new Error('No se pudo actualizar la disponibilidad');
    }
    
    // Determinar mensaje según el cambio
    const message = isDisponible ? 
      `"${productoActual.nombre}" ahora es visible en la tienda` :
      `"${productoActual.nombre}" ahora está oculto en la tienda`;
    
    // Responder con éxito
    res.json({
      success: true,
      message: message,
      disponible: isDisponible,
      productId: id,
      productName: productoActual.nombre
    });
    
  } catch (error) {
    console.error('Error al actualizar disponibilidad del producto:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor al actualizar la disponibilidad'
    });
  }
};