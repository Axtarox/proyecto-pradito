/**
 * Controlador para el manejo de Productos completo
 */

const path = require('path');
const { formatPrice } = require('../helpers/formatHelper');
const Producto = require('../models/Producto');
const Categoria = require('../models/Categoria');

/**
 * Obtiene todos los productos DISPONIBLES para la tienda pública
 */
exports.getAllProductos = async (req, res) => {
    try {
        // Obtener SOLO los productos disponibles para la tienda pública
        const productos = await Producto.getAllAvailable();
        
        // Formatear los precios para visualización
        const productosFormateados = productos.map(producto => ({
            ...producto,
            precio: formatPrice(producto.precio)
        }));
        
        // Obtener todas las categorías para el filtro
        const categorias = await Categoria.getAll();
        
        // Agregar función de formateo para la vista
        res.locals.formatPrice = formatPrice;
        
        res.render('productos', {
            productos: productosFormateados,
            categorias,
            titulo: 'Nuestros Productos'
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
 * Obtiene un producto por su ID SOLO SI ESTÁ DISPONIBLE
 */
exports.getProductoById = async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        
        if (isNaN(id)) {
            return res.status(400).render('error', {
                titulo: 'Error',
                mensaje: 'ID de producto inválido'
            });
        }
        
        // Obtener el producto desde la base de datos SOLO SI ESTÁ DISPONIBLE
        const producto = await Producto.getByIdAvailable(id);
        
        if (!producto) {
            return res.status(404).render('error', {
                titulo: 'Error',
                mensaje: 'Producto no encontrado o no disponible'
            });
        }
        
        // Extraer características y limpiar la lista
        let caracteristicasList = [];
        if (producto.caracteristicas) {
            // Más opciones de separación para las características
            caracteristicasList = producto.caracteristicas
                .split(/\n|\r|\r\n|-|•|\\n/)
                .map(item => item.trim())
                .filter(item => item.length > 0);
        }
        
        // Formatear el precio para visualización
        producto.precio = formatPrice(producto.precio);
        
        // Agregar función de formateo para la vista
        res.locals.formatPrice = formatPrice;
        
        // Renderizar vista con datos
        return res.render('producto-detalle', {
            titulo: producto.nombre || 'Detalle de Producto',
            isProductoDetalle: true,
            producto,
            caracteristicasList
        });
    } catch (error) {
        console.error('Error en getProductoById:', error);
        return res.status(500).render('error', {
            titulo: 'Error',
            mensaje: 'Error al cargar el producto',
            error: process.env.NODE_ENV === 'development' ? error.stack : null
        });
    }
};

/**
 * Obtiene productos por categoría 
 */
exports.getProductosByCategoria = async (req, res) => {
    try {
        const categoriaId = parseInt(req.params.id, 10);
        
        if (isNaN(categoriaId)) {
            return res.status(400).render('error', {
                titulo: 'Error',
                mensaje: 'ID de categoría inválido'
            });
        }
        
        // Obtener la categoría seleccionada
        const categoria = await Categoria.getById(categoriaId);
        
        if (!categoria) {
            return res.status(404).render('error', {
                titulo: 'Error',
                mensaje: 'Categoría no encontrada'
            });
        }
        
        // Obtener productos por categoría 
        const productos = await Producto.getByCategoria(categoriaId);
        
        // Formatear precios para visualización
        const productosFormateados = productos.map(producto => ({
            ...producto,
            precio: formatPrice(producto.precio)
        }));
        
        // Obtener todas las categorías para el filtro
        const categorias = await Categoria.getAll();
        
        // Marcar la categoría seleccionada
        const categoriasConSeleccion = categorias.map(cat => ({
            ...cat,
            selected: cat.id === categoriaId
        }));
        
        // Agregar función de formateo para la vista
        res.locals.formatPrice = formatPrice;
        
        res.render('productos-categoria', {
            productos: productosFormateados,
            categoria,
            categorias: categoriasConSeleccion,
            titulo: `Productos: ${categoria.nombre}`
        });
    } catch (error) {
        console.error('Error al obtener productos por categoría:', error);
        res.status(500).render('error', {
            titulo: 'Error',
            mensaje: 'Error al cargar los productos por categoría',
            error: process.env.NODE_ENV === 'development' ? error.message : null
        });
    }
};

/**
 * Busca productos por términos 
 */
exports.searchProductos = async (req, res) => {
    try {
        const query = req.query.q || '';
        
        if (!query.trim()) {
            return res.redirect('/productos');
        }
        
        // Buscar productos que coincidan con la consulta 
        const productos = await Producto.search(query);
        
        // Formatear precios para visualización
        const productosFormateados = productos.map(producto => ({
            ...producto,
            precio: formatPrice(producto.precio)
        }));
        
        // Obtener todas las categorías para el filtro
        const categorias = await Categoria.getAll();
        
        // Agregar función de formateo para la vista
        res.locals.formatPrice = formatPrice;
        
        res.render('productos-busqueda', {
            productos: productosFormateados,
            categorias,
            query,
            titulo: `Resultados para: ${query}`
        });
    } catch (error) {
        console.error('Error al buscar productos:', error);
        res.status(500).render('error', {
            titulo: 'Error',
            mensaje: 'Error al buscar productos',
            error: process.env.NODE_ENV === 'development' ? error.message : null
        });
    }
};

/**
 * Obtiene productos destacados 
 */
exports.getProductosDestacados = async (req, res) => {
    try {
        // Obtener los productos destacados 
        const productos = await Producto.getFeatured(8);
        
        // Formatear precios para visualización
        const productosFormateados = productos.map(producto => ({
            ...producto,
            precio: formatPrice(producto.precio)
        }));
        
        // Agregar función de formateo para la vista
        res.locals.formatPrice = formatPrice;
        
        res.render('productos-destacados', {
            productos: productosFormateados,
            titulo: 'Productos Destacados'
        });
    } catch (error) {
        console.error('Error al obtener productos destacados:', error);
        res.status(500).render('error', {
            titulo: 'Error',
            mensaje: 'Error al cargar los productos destacados',
            error: process.env.NODE_ENV === 'development' ? error.message : null
        });
    }
};